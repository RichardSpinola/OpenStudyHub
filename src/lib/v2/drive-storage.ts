import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { recordAdminAction } from "./audit";
import type { V2Database } from "./database";
import { DRIVE_SCOPE } from "./google-config";
import { googleAccessTokenV2 } from "./google-oauth";
import type { StorageProvider, StoredObject } from "./storage";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_BACKEND = "Central Drive";
type GoogleFetch = typeof fetch;

function hasDriveScope(scopes: string) {
  return scopes.split(" ").includes(DRIVE_SCOPE);
}
export function storageOwnerStatus(db: V2Database) {
  const row = db
    .prepare(
      `SELECT b.id,b.owner_user_id ownerId,u.display_name ownerName,b.state,b.root_ref rootRef,
      c.status connectionStatus,c.scopes
     FROM storage_backends b LEFT JOIN users u ON u.id=b.owner_user_id
     LEFT JOIN google_connections_v2 c ON c.user_id=b.owner_user_id
     WHERE b.name=? AND b.kind='google-drive'`,
    )
    .get(DRIVE_BACKEND) as
    | {
        id: number;
        ownerId: number | null;
        ownerName: string | null;
        state: string;
        rootRef: string | null;
        connectionStatus: string | null;
        scopes: string | null;
      }
    | undefined;
  return row
    ? {
        backendId: row.id,
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        state: row.state,
        rootReady: !!row.rootRef,
        connected:
          row.connectionStatus === "connected" &&
          !!row.scopes &&
          hasDriveScope(row.scopes),
      }
    : null;
}
export function storageOwnerCandidates(db: V2Database) {
  const rows = db
    .prepare(
      `SELECT u.id,u.display_name name,c.scopes FROM users u
     JOIN google_connections_v2 c ON c.user_id=u.id
     WHERE u.active=1 AND c.status='connected' ORDER BY u.display_name,u.id`,
    )
    .all() as Array<{ id: number; name: string; scopes: string }>;
  return rows
    .filter((row) => hasDriveScope(row.scopes))
    .map(({ id, name }) => ({ id, name }));
}
export function setStorageOwner(
  db: V2Database,
  actor: Actor,
  ownerId: number | null,
): void {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin pode configurar o storage owner.");
  if (
    ownerId !== null &&
    !storageOwnerCandidates(db).some((row) => row.id === ownerId)
  )
    throw new Error("Escolha um usuário normal conectado com permissão Drive.");
  const current = storageOwnerStatus(db);
  if (!current && ownerId === null) return;
  if (
    current?.ownerId !== ownerId &&
    current &&
    db
      .prepare(
        "SELECT 1 FROM storage_objects WHERE backend_id=? AND archived_at IS NULL LIMIT 1",
      )
      .get(current.backendId)
  )
    throw new Error(
      "Há objetos no Drive atual. Migre ou arquive antes de trocar o owner.",
    );
  db.transaction(() => {
    let backendId = current?.backendId;
    if (current)
      db.prepare(
        "UPDATE storage_backends SET owner_user_id=?,root_ref=NULL,state=? WHERE id=?",
      ).run(
        ownerId,
        ownerId === null ? "disabled" : "ready",
        current.backendId,
      );
    else if (ownerId !== null)
      backendId = Number(
        db
          .prepare(
            "INSERT INTO storage_backends(kind,name,owner_user_id,state) VALUES('google-drive',?,?,'ready')",
          )
          .run(DRIVE_BACKEND, ownerId).lastInsertRowid,
      );
    recordAdminAction(
      db,
      actor,
      "storage.owner_update",
      "storage_backend",
      backendId ?? 0,
    );
    if (current?.ownerId !== ownerId)
      db.prepare(
        "UPDATE google_automation_v2 SET drive_status='pending',last_drive_check_at=NULL WHERE id=1",
      ).run();
  })();
}

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly kind = "google-drive";
  constructor(
    private readonly db: V2Database,
    private readonly backendId: number,
    private readonly fetchImpl: GoogleFetch = fetch,
    private readonly token: (
      db: V2Database,
      userId: number,
    ) => Promise<string> = googleAccessTokenV2,
  ) {}
  private async context() {
    const row = this.db
      .prepare(
        `SELECT b.owner_user_id ownerId,b.root_ref rootRef,b.state,u.active,c.status,c.scopes
       FROM storage_backends b JOIN users u ON u.id=b.owner_user_id
       JOIN google_connections_v2 c ON c.user_id=u.id
       WHERE b.id=? AND b.kind='google-drive'`,
      )
      .get(this.backendId) as
      | {
          ownerId: number;
          rootRef: string | null;
          state: string;
          active: number;
          status: string;
          scopes: string;
        }
      | undefined;
    if (
      !row ||
      !row.active ||
      row.state !== "ready" ||
      row.status !== "connected" ||
      !hasDriveScope(row.scopes)
    )
      throw new Error("Storage owner precisa reconectar Google Drive.");
    return { ...row, access: await this.token(this.db, row.ownerId) };
  }
  private async request(access: string, url: string, init: RequestInit = {}) {
    return this.fetchImpl(url, {
      ...init,
      headers: { authorization: `Bearer ${access}`, ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
  }
  private async root(
    access: string,
    current: string | null,
    desiredName?: string,
  ): Promise<string> {
    if (current) {
      const response = await this.request(
        access,
        `${API}/${encodeURIComponent(current)}?fields=id,name,mimeType,trashed`,
      );
      if (response.status === 403)
        throw new Error("Permissão negada ao diretório Drive.");
      if (response.status === 404)
        throw new Error(
          "Referência Drive ambígua; Admin deve reparar o diretório.",
        );
      if (!response.ok) throw new Error("Drive temporariamente indisponível.");
      const meta = (await response.json()) as {
        name?: string;
        mimeType?: string;
        trashed?: boolean;
      };
      if (
        meta.trashed ||
        meta.mimeType !== "application/vnd.google-apps.folder"
      )
        throw new Error("Diretório Drive precisa de reparo.");
      if (desiredName && meta.name !== desiredName) {
        const renamed = await this.request(
          access,
          `${API}/${encodeURIComponent(current)}?fields=id`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: desiredName }),
          },
        );
        if (!renamed.ok)
          throw new Error("Não foi possível renomear diretório Drive.");
      }
      return current;
    }
    const response = await this.request(access, API + "?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: desiredName ?? "OpenStudyHub",
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { openStudyHub: "central-v2" },
      }),
    });
    if (!response.ok)
      throw new Error("Não foi possível criar diretório Drive.");
    const body = (await response.json()) as { id?: string };
    if (!body.id) throw new Error("Drive não retornou referência.");
    this.db
      .prepare(
        "UPDATE storage_backends SET root_ref=? WHERE id=? AND root_ref IS NULL",
      )
      .run(body.id, this.backendId);
    const saved = this.db
      .prepare("SELECT root_ref ref FROM storage_backends WHERE id=?")
      .get(this.backendId) as { ref: string };
    return saved.ref;
  }
  async ensureRootFolder(name: string): Promise<string> {
    const desiredName = name.trim();
    if (!desiredName) throw new Error("Nome do diretório Drive inválido.");
    const context = await this.context();
    return this.root(context.access, context.rootRef, desiredName);
  }
  async put(bytes: Uint8Array): Promise<StoredObject> {
    const context = await this.context();
    const parent = await this.root(context.access, context.rootRef);
    const key = randomUUID();
    const created = await this.request(context.access, API + "?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: key,
        parents: [parent],
        appProperties: { openStudyHubObject: key },
      }),
    });
    if (!created.ok) throw new Error("Falha ao criar arquivo Drive.");
    const file = (await created.json()) as { id?: string };
    if (!file.id) throw new Error("Drive não retornou arquivo.");
    try {
      const uploaded = await this.request(
        context.access,
        `${UPLOAD}/${encodeURIComponent(file.id)}?uploadType=media`,
        {
          method: "PATCH",
          headers: { "content-type": "application/octet-stream" },
          body: Buffer.from(bytes),
        },
      );
      if (!uploaded.ok) throw new Error("Falha ao gravar arquivo Drive.");
    } catch (error) {
      await this.delete(file.id).catch(() => undefined);
      throw error;
    }
    return {
      key,
      providerRef: file.id,
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  async get(providerRef: string): Promise<Uint8Array> {
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(providerRef))
      throw new Error("Referência Drive inválida.");
    const context = await this.context();
    const response = await this.request(
      context.access,
      `${API}/${encodeURIComponent(providerRef)}?alt=media`,
    );
    if (response.status === 403)
      throw new Error("Permissão negada ao arquivo Drive.");
    if (response.status === 404)
      throw new Error("Arquivo Drive ausente ou inacessível.");
    if (!response.ok) throw new Error("Drive temporariamente indisponível.");
    return new Uint8Array(await response.arrayBuffer());
  }
  async delete(providerRef: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(providerRef))
      throw new Error("Referência Drive inválida.");
    const context = await this.context();
    const response = await this.request(
      context.access,
      `${API}/${encodeURIComponent(providerRef)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      },
    );
    if (response.status === 403)
      throw new Error("Permissão negada ao arquivo Drive.");
    if (!response.ok && response.status !== 404)
      throw new Error("Falha ao remover arquivo Drive.");
  }
  health(): "ready" | "degraded" {
    return storageOwnerStatus(this.db)?.connected ? "ready" : "degraded";
  }
  // Explicit repair follows an operator decision after a 404, which can also
  // mean permission loss at Google. The old reference is never silently erased.
  async repairRoot(actor: Actor, desiredName: string): Promise<string> {
    if (!isAdmin(this.db, actor))
      throw new Error("Somente Admin pode reparar Drive.");
    const safeName = desiredName.trim();
    if (!safeName) throw new Error("Nome da instituição não configurado.");
    const context = await this.context();
    const old = context.rootRef;
    if (old) {
      const check = await this.request(
        context.access,
        `${API}/${encodeURIComponent(old)}?fields=id,mimeType,trashed`,
      );
      if (check.ok) {
        const ref = await this.root(context.access, old, safeName);
        recordAdminAction(
          this.db,
          actor,
          "storage.root_repair",
          "storage_backend",
          this.backendId,
        );
        return ref;
      }
      if (check.status === 403)
        throw new Error("Permissão negada ao diretório Drive.");
      if (check.status !== 404)
        throw new Error("Drive temporariamente indisponível.");
    }
    this.db
      .prepare("UPDATE storage_backends SET root_ref=NULL WHERE id=?")
      .run(this.backendId);
    try {
      const ref = await this.root(context.access, null, safeName);
      recordAdminAction(
        this.db,
        actor,
        "storage.root_repair",
        "storage_backend",
        this.backendId,
      );
      return ref;
    } catch (error) {
      this.db
        .prepare("UPDATE storage_backends SET root_ref=? WHERE id=?")
        .run(old, this.backendId);
      throw error;
    }
  }
}
