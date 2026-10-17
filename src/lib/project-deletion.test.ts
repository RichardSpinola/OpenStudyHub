import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMigratedTestDatabase } from "./test-database";
import {
  createProject,
  prepareProjectUpload,
  confirmProjectUpload,
} from "./projects";
import { deleteOwnedProject } from "./project-deletion";
import { readLocalProjectArchive } from "./project-local-storage";
vi.mock("./google/oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "synthetic-token"),
}));
let connection: ReturnType<typeof createMigratedTestDatabase>, root: string;
beforeEach(async () => {
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "0");
  root = await mkdtemp(join(tmpdir(), "osh-delete-test-"));
  vi.stubEnv("PRIVATE_ASSET_PATH", root);
  connection = createMigratedTestDatabase();
  connection.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(1,'Owner','owner','fake','member'),(2,'Other','other','fake','member')",
  );
});
afterEach(async () => {
  connection.close();
  await rm(root, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const project = (backend: "local" | "google-drive" = "local") =>
  createProject(
    1,
    {
      name: "Projeto teste",
      storageBackend: backend,
      language: "other",
      ignorePreset: "other",
    },
    connection,
  );
describe("permanent project deletion", () => {
  it("requires owner and exact name; refuses an active upload", async () => {
    const p = project();
    await expect(
      deleteOwnedProject(2, p.id, p.name, { connection }),
    ).rejects.toThrow("permissão");
    await expect(
      deleteOwnedProject(1, p.id, "wrong", { connection }),
    ).rejects.toThrow("nome exato");
    connection.sqlite
      .prepare(
        "INSERT INTO project_upload_claims(token,claim_id,project_id,owner_user_id,claimed_at,heartbeat_at) VALUES(?,?,?,1,?,?)",
      )
      .run("active", "active", p.id, Date.now(), Date.now());
    await expect(
      deleteOwnedProject(1, p.id, p.name, { connection }),
    ).rejects.toThrow("envio em andamento");
  });
  it("deletes archived local projects, ZIPs, versions and receipts without touching another project", async () => {
    const p = project(),
      other = project();
    const preview = await prepareProjectUpload(
      1,
      p.id,
      {
        files: [{ path: "readme.txt", data: Buffer.from("test") }],
        baseVersionNumber: null,
      },
      connection,
    );
    await confirmProjectUpload(1, preview.token, null, { connection });
    const ref = (
      connection.sqlite
        .prepare(
          "SELECT archive_drive_file_id ref FROM project_versions WHERE project_id=?",
        )
        .get(p.id) as { ref: string }
    ).ref;
    connection.sqlite
      .prepare("UPDATE projects SET archived_at=? WHERE id=?")
      .run(Date.now(), p.id);
    await deleteOwnedProject(1, p.id, p.name, { connection });
    await expect(readLocalProjectArchive(connection, ref)).rejects.toThrow();
    expect(
      connection.sqlite.prepare("SELECT 1 FROM projects WHERE id=?").get(p.id),
    ).toBeUndefined();
    expect(
      connection.sqlite
        .prepare("SELECT 1 FROM project_upload_receipts WHERE project_id=?")
        .get(p.id),
    ).toBeUndefined();
    expect(
      connection.sqlite
        .prepare("SELECT 1 FROM projects WHERE id=?")
        .get(other.id),
    ).toBeTruthy();
    expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
  });
  it("uses DELETE for the dedicated Drive folder and keeps metadata if Drive fails, then supports retry", async () => {
    const p = project("google-drive");
    connection.sqlite
      .prepare("UPDATE projects SET drive_project_folder_id=? WHERE id=?")
      .run("folder-only-this-project", p.id);
    const failed = vi.fn(async () => new Response(null, { status: 403 }));
    await expect(
      deleteOwnedProject(1, p.id, p.name, { connection, fetchImpl: failed }),
    ).rejects.toThrow("Drive");
    expect(
      connection.sqlite.prepare("SELECT 1 FROM projects WHERE id=?").get(p.id),
    ).toBeTruthy();
    const success = vi.fn<
      (url: unknown, init?: RequestInit) => Promise<Response>
    >(async () => new Response(null, { status: 204 }));
    await deleteOwnedProject(1, p.id, p.name, {
      connection,
      fetchImpl: success,
    });
    expect(String(success.mock.calls[0]?.[0])).toContain(
      "/folder-only-this-project?",
    );
    expect(
      (success.mock.calls[0] as unknown as [unknown, RequestInit])[1].method,
    ).toBe("DELETE");
    expect(
      connection.sqlite.prepare("SELECT 1 FROM projects WHERE id=?").get(p.id),
    ).toBeUndefined();
  });
  it("refuses folder references shared by two projects before any remote request", async () => {
    const p = project("google-drive"),
      other = project("google-drive");
    connection.sqlite
      .prepare(
        "UPDATE projects SET drive_project_folder_id=? WHERE id IN (?,?)",
      )
      .run("shared-root", p.id, other.id);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(
      deleteOwnedProject(1, p.id, p.name, { connection, fetchImpl }),
    ).rejects.toThrow("exclusiva");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
