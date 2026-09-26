import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { listSubjectOfferings } from "@/lib/academic";
import { detectHomeImage, safeHomeAssetPath } from "@/lib/home-background";
import { getServerEnvironment } from "@/lib/env";
import type { Actor } from "./actor";
import { canManage, isAdmin } from "./access";
import { recordAdminAction } from "./audit";
import type { V2Database } from "./database";

export const offeringCoverLimitBytes = 5 * 1024 * 1024;

export function linkLegacyOffering(
  db: V2Database,
  actor: Actor,
  offeringId: number,
  legacyOfferingId: number,
) {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin pode confirmar a ligação com a V1.");
  if (
    !Number.isSafeInteger(offeringId) ||
    !db.prepare("SELECT 1 FROM offerings WHERE id=?").get(offeringId)
  )
    throw new Error("Turma da disciplina V2 inválida.");
  if (
    !Number.isSafeInteger(legacyOfferingId) ||
    !listSubjectOfferings().some((item) => item.offeringId === legacyOfferingId)
  )
    throw new Error("Turma da disciplina V1 não encontrada.");
  db.transaction(() => {
    db.prepare(
      `INSERT INTO legacy_offering_links(offering_id,legacy_offering_id,linked_by_admin_id,linked_at)
      VALUES(?,?,?,?) ON CONFLICT(offering_id) DO UPDATE SET legacy_offering_id=excluded.legacy_offering_id,linked_by_admin_id=excluded.linked_by_admin_id,linked_at=excluded.linked_at`,
    ).run(offeringId, legacyOfferingId, actor.id, Date.now());
    recordAdminAction(
      db,
      actor,
      "offering.legacy_link",
      "offering",
      offeringId,
    );
  })();
}

export async function saveOfferingCover(
  db: V2Database,
  actor: Actor,
  offeringId: number,
  data: Buffer,
) {
  if (
    !canManage(db, actor, "manage_academics", {
      kind: "offering",
      id: offeringId,
    })
  )
    throw new Error("Sem permissão para a capa desta disciplina.");
  if (!data.length || data.length > offeringCoverLimitBytes)
    throw new Error("A capa deve ter até 5 MiB.");
  const image = await detectHomeImage(data);
  if (!image)
    throw new Error("Envie PNG, JPEG ou WebP com até 16 milhões de pixels.");
  const root = getServerEnvironment().PRIVATE_ASSET_PATH;
  await mkdir(root, { recursive: true, mode: 0o700 });
  const storageName = `${randomUUID()}.${image.extension}`;
  const finalPath = safeHomeAssetPath(storageName, root);
  await writeFile(`${finalPath}.tmp`, data, { flag: "wx", mode: 0o600 });
  await rename(`${finalPath}.tmp`, finalPath);
  let previous: string | undefined;
  try {
    db.transaction(() => {
      previous = (
        db
          .prepare(
            "SELECT storage_name storageName FROM offering_covers WHERE offering_id=?",
          )
          .get(offeringId) as { storageName: string } | undefined
      )?.storageName;
      db.prepare(
        `INSERT INTO offering_covers(offering_id,storage_name,mime_type,size_bytes,updated_at)
        VALUES(?,?,?,?,?) ON CONFLICT(offering_id) DO UPDATE SET storage_name=excluded.storage_name,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,updated_at=excluded.updated_at`,
      ).run(offeringId, storageName, image.mimeType, data.length, Date.now());
      recordAdminAction(
        db,
        actor,
        "offering.cover_update",
        "offering",
        offeringId,
      );
    })();
  } catch (error) {
    await unlink(finalPath).catch(() => undefined);
    throw error;
  }
  if (previous)
    await unlink(safeHomeAssetPath(previous, root)).catch(() => undefined);
}

export async function removeOfferingCover(
  db: V2Database,
  actor: Actor,
  offeringId: number,
): Promise<void> {
  if (
    !canManage(db, actor, "manage_academics", {
      kind: "offering",
      id: offeringId,
    })
  )
    throw new Error("Sem permissão para a capa desta disciplina.");
  const existing = db
    .prepare(
      "SELECT storage_name storageName FROM offering_covers WHERE offering_id=?",
    )
    .get(offeringId) as { storageName: string } | undefined;
  if (!existing) return;
  db.transaction(() => {
    db.prepare("DELETE FROM offering_covers WHERE offering_id=?").run(
      offeringId,
    );
    recordAdminAction(
      db,
      actor,
      "offering.cover_remove",
      "offering",
      offeringId,
    );
  })();
  await unlink(
    safeHomeAssetPath(
      existing.storageName,
      getServerEnvironment().PRIVATE_ASSET_PATH,
    ),
  ).catch(() => undefined);
}

export function coverForLegacyOffering(
  db: V2Database,
  legacyOfferingId: number,
) {
  return db
    .prepare(
      `SELECT c.storage_name storageName,c.mime_type mimeType FROM legacy_offering_links l
    JOIN offering_covers c ON c.offering_id=l.offering_id WHERE l.legacy_offering_id=?`,
    )
    .get(legacyOfferingId) as
    { storageName: string; mimeType: string } | undefined;
}

export function legacyOfferingIdsWithCover(
  db: V2Database,
  legacyIds: number[],
) {
  if (!legacyIds.length) return new Set<number>();
  const rows = db
    .prepare(
      `SELECT l.legacy_offering_id id FROM legacy_offering_links l JOIN offering_covers c ON c.offering_id=l.offering_id WHERE l.legacy_offering_id IN (${legacyIds.map(() => "?").join(",")})`,
    )
    .all(...legacyIds) as Array<{ id: number }>;
  return new Set(rows.map((row) => row.id));
}

export function coverForOffering(db: V2Database, offeringId: number) {
  return db
    .prepare(
      "SELECT storage_name storageName,mime_type mimeType FROM offering_covers WHERE offering_id=?",
    )
    .get(offeringId) as { storageName: string; mimeType: string } | undefined;
}

export async function readOfferingCover(row: {
  storageName: string;
  mimeType: string;
}) {
  try {
    return {
      data: await readFile(
        safeHomeAssetPath(
          row.storageName,
          getServerEnvironment().PRIVATE_ASSET_PATH,
        ),
      ),
      mimeType: row.mimeType,
    };
  } catch {
    return null;
  }
}
