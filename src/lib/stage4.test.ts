import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDatabase, type DatabaseConnection } from "./db/client";
import { applyMigration, migrationFiles } from "./test-database";
import {
  createProject,
  prepareProjectUpload,
  confirmProjectUpload,
  getProjectRetryPreview,
  downloadProjectVersion,
  readProjectSource,
  getUserProject,
  archiveUserProject,
  restoreUserProject,
  cleanupExpiredPreviews,
  setProjectGroupShare,
  groupSharedProjectIds,
  cancelProjectUploadPreview,
} from "./projects";
import { projectStagingRoot } from "./project-local-storage";
const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const p of roots.splice(0))
    await rm(p, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "osh-stage4-test-"));
  roots.push(dir);
  vi.stubEnv("PRIVATE_ASSET_PATH", join(dir, "private"));
  vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "0");
  const connection = createDatabase(join(dir, "db.sqlite"));
  migrationFiles.forEach((m) => applyMigration(connection, m));
  connection.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(1,'Owner','owner','fake','member'),(2,'Other','other','fake','member')",
  );
  const project = createProject(
    1,
    {
      name: "Projeto local",
      storageBackend: "local",
      language: "other",
      ignorePreset: "other",
    },
    connection,
  );
  return { connection, project, dir };
}
const upload = (
  connection: DatabaseConnection,
  id: number,
  data = "primeiro",
  base: number | null = null,
) =>
  prepareProjectUpload(
    1,
    id,
    {
      files: [{ path: "src/main.txt", data: Buffer.from(data) }],
      baseVersionNumber: base,
    },
    connection,
  );
describe("V3 stage4 local and persistent projects", () => {
  it("survives process/database restart, confirms once, returns receipt on retry, and denies unrelated users", async () => {
    const f = await fixture();
    const p = await upload(f.connection, f.project.id);
    expect(getProjectRetryPreview(1, f.project.id, f.connection)?.token).toBe(
      p.token,
    );
    expect(projectStagingRoot(f.connection)).toContain(
      "/private/projects/staging",
    );
    f.connection.close();
    const connection = createDatabase(join(f.dir, "db.sqlite"));
    try {
      const fetchImpl = vi.fn(() => {
        throw new Error("Google must not be used");
      }) as typeof fetch;
      await expect(
        confirmProjectUpload(1, p.token, "wrong project", {
          connection,
          expectedProjectId: f.project.id + 999,
        }),
      ).rejects.toThrow();
      const result = await confirmProjectUpload(1, p.token, "Versão inicial", {
        connection,
        fetchImpl,
      });
      expect(result.versionNumber).toBe(1);
      expect(
        await confirmProjectUpload(1, p.token, "repeat", {
          connection,
          fetchImpl,
        }),
      ).toEqual(result);
      expect(
        connection.sqlite
          .prepare("SELECT count(*) n FROM project_versions")
          .get(),
      ).toEqual({ n: 1 });
      expect(
        await readProjectSource(1, f.project.id, "src/main.txt", {
          connection,
        }),
      ).toEqual(Buffer.from("primeiro"));
      expect(
        (await downloadProjectVersion(1, f.project.id, 1, { connection }))
          .length,
      ).toBeGreaterThan(0);
      await expect(
        downloadProjectVersion(2, f.project.id, 1, { connection }),
      ).rejects.toThrow("not found");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(connection.sqlite.pragma("foreign_key_check")).toEqual([]);
    } finally {
      connection.close();
    }
  });
  it("serializes concurrent confirmations, preserves older downloads, and archives/restores without losing versions", async () => {
    const { connection, project } = await fixture();
    try {
      const p = await upload(connection, project.id);
      const results = await Promise.allSettled([
        confirmProjectUpload(1, p.token, "first", { connection }),
        confirmProjectUpload(1, p.token, "double", { connection }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const p2 = await upload(connection, project.id, "segundo", 1);
      await confirmProjectUpload(1, p2.token, "second", { connection });
      expect(
        getUserProject(1, project.id, connection).currentVersionNumber,
      ).toBe(2);
      expect(
        (await downloadProjectVersion(1, project.id, 1, { connection })).length,
      ).toBeGreaterThan(0);
      archiveUserProject(1, project.id, connection);
      expect(() => getUserProject(1, project.id, connection)).toThrow();
      expect(() => restoreUserProject(2, project.id, connection)).toThrow();
      expect(
        restoreUserProject(1, project.id, connection).currentVersionNumber,
      ).toBe(2);
    } finally {
      connection.close();
    }
  });
  it("keeps an active claim during expiry cleanup, allows cancelling an idle preview and detects tampering", async () => {
    const { connection, project } = await fixture();
    try {
      const p = await upload(connection, project.id);
      await cancelProjectUploadPreview(1, p.token, connection);
      expect(getProjectRetryPreview(1, project.id, connection)).toBeNull();
      const p2 = await upload(connection, project.id);
      const record = getProjectRetryPreview(1, project.id, connection)!;
      connection.sqlite
        .prepare(
          "UPDATE project_upload_previews SET expires_at=? WHERE token=?",
        )
        .run(Date.now() - 10, p2.token);
      connection.sqlite
        .prepare("INSERT INTO project_upload_claims VALUES(?,?,?,?,?,?)")
        .run(p2.token, "fake-lease", project.id, 1, Date.now(), Date.now());
      await cleanupExpiredPreviews(connection);
      expect((await readFile(record.tempArchivePath)).length).toBeGreaterThan(
        0,
      );
      connection.sqlite.prepare("DELETE FROM project_upload_claims").run();
      await cleanupExpiredPreviews(connection);
      await expect(readFile(record.tempArchivePath)).rejects.toThrow();
      const p3 = await upload(connection, project.id);
      await writeFile(
        getProjectRetryPreview(1, project.id, connection)!.tempArchivePath,
        Buffer.from("invalid zip"),
      );
      await expect(
        confirmProjectUpload(1, p3.token, "tampered", { connection }),
      ).rejects.toThrow();
      expect(
        getUserProject(1, project.id, connection).currentVersionNumber,
      ).toBe(0);
    } finally {
      connection.close();
    }
  });
  it("shares with current group members only and immediately revokes departed members", async () => {
    const { connection, project } = await fixture();
    try {
      connection.sqlite.exec(
        "INSERT INTO study_groups(id,name,created_by_user_id) VALUES(1,'Grupo',1);INSERT INTO study_group_members(group_id,user_id,member_role) VALUES(1,1,'owner'),(1,2,'member')",
      );
      setProjectGroupShare(1, project.id, 1, true, connection);
      expect(groupSharedProjectIds(2, connection)).toEqual([project.id]);
      expect(getUserProject(2, project.id, connection).name).toBe(project.name);
      expect(() => archiveUserProject(2, project.id, connection)).toThrow(
        "leitura",
      );
      connection.sqlite.exec("DELETE FROM study_group_members WHERE user_id=2");
      expect(() => getUserProject(2, project.id, connection)).toThrow(
        "not found",
      );
    } finally {
      connection.close();
    }
  });
});
