import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createDatabase } from "@/lib/db/client";
import { applyMigration, migrationFiles } from "@/lib/test-database";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { resolveDriveStorageUser } from "@/lib/google/storage-owner";

import {
  archiveUserProject,
  cancelProjectUploadPreview,
  confirmProjectUpload,
  createProject,
  getProjectDriveStorageUser,
  getProjectRetryPreview,
  getProjectSyncFailureStage,
  getUserProject,
  updateProjectTechnology,
  prepareProjectUpload,
  ProjectConflictError,
} from "./projects";

vi.mock("@/lib/google/oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "access-token"),
}));
vi.mock("@/lib/google/storage-owner", () => ({
  resolveDriveStorageUser: vi.fn(),
}));

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  connection.sqlite
    .prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)")
    .run("institution.display_name", "Instituição Teste", now);
  const userInsert = connection.sqlite.prepare(
    `insert into users
     (display_name, login, password_hash, role, active,
      password_changed_at, created_at, updated_at)
     values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
  );
  const ownerId = Number(
    userInsert.run("Owner", "project-owner", now, now, now).lastInsertRowid,
  );
  const otherId = Number(
    userInsert.run("Other", "project-other", now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare(
        "insert into programs (name,short_name) values ('Program','ADS')",
      )
      .run().lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name) values ('Subject')")
      .run().lastInsertRowid,
  );
  const periodId = Number(
    connection.sqlite
      .prepare(
        "insert into academic_periods (label, starts_on, ends_on) values ('2030.1', '2030-01-01', '2030-06-30')",
      )
      .run().lastInsertRowid,
  );
  const offeringId = Number(
    connection.sqlite
      .prepare(
        "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
      )
      .run(subjectId, programId, periodId).lastInsertRowid,
  );
  connection.sqlite
    .prepare("insert into enrollments (user_id, offering_id) values (?, ?)")
    .run(ownerId, offeringId);
  connection.sqlite
    .prepare(
      `insert into google_connections
       (user_id, google_subject, account_email, encrypted_refresh_token,
        granted_scopes, status)
       values (?, 'project-google', 'project@example.test', 'encrypted',
               'drive.file', 'connected')`,
    )
    .run(ownerId);
  return { ownerId, otherId, offeringId };
}

describe("projects", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });
  afterEach(() => connection.close());

  it("permite criar somente dentro da matrícula e preserva ownership", () => {
    const { ownerId, otherId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto pessoal",
        language: "python",
        ignorePreset: "python",
        technologies: ["python"],
        description: "Demo",
      },
      connection,
    );
    expect(getUserProject(ownerId, project.id, connection).language).toBe(
      "python",
    );
    expect(
      getUserProject(ownerId, project.id, connection).technologies,
    ).toEqual(["python"]);
    expect(() => getUserProject(otherId, project.id, connection)).toThrow();
    expect(() =>
      createProject(
        otherId,
        {
          offeringId,
          name: "Inválido",
          language: "other",
          ignorePreset: "other",
        },
        connection,
      ),
    ).toThrow("outside");
    expect(() => archiveUserProject(otherId, project.id, connection)).toThrow();
    archiveUserProject(ownerId, project.id, connection);
    expect(() => getUserProject(ownerId, project.id, connection)).toThrow();
    expect(
      connection.sqlite
        .prepare(
          "select drive_project_folder_id as driveProjectFolderId from projects where id = ?",
        )
        .get(project.id),
    ).toEqual({ driveProjectFolderId: null });
  });

  it("creates a personal project for an active user without enrollment and isolates uploads", async () => {
    const { ownerId, otherId } = seed(connection);
    const project = createProject(
      otherId,
      { name: "Pessoal", language: "other", ignorePreset: "other" },
      connection,
    );
    expect(project).toMatchObject({
      ownerUserId: otherId,
      offeringId: null,
      subjectId: null,
    });
    expect(() => getUserProject(ownerId, project.id, connection)).toThrow();
    await expect(
      prepareProjectUpload(
        ownerId,
        project.id,
        {
          baseVersionNumber: null,
          files: [{ path: "demo.txt", data: Buffer.from("demo") }],
        },
        connection,
      ),
    ).rejects.toThrow();
    const preview = await prepareProjectUpload(
      otherId,
      project.id,
      {
        baseVersionNumber: null,
        files: [{ path: "demo.txt", data: Buffer.from("demo") }],
      },
      connection,
    );
    await cancelProjectUploadPreview(otherId, preview.token, connection);
    connection.sqlite
      .prepare("UPDATE users SET active=0 WHERE id=?")
      .run(otherId);
    expect(() =>
      createProject(
        otherId,
        { name: "Inativo", language: "other", ignorePreset: "other" },
        connection,
      ),
    ).toThrow("Active owner");
  });
  it("upgrades academic projects without rebuilding their versions or breaking foreign keys", () => {
    const old = createDatabase(":memory:");
    try {
      for (const file of migrationFiles.slice(0, -1)) applyMigration(old, file);
      const { ownerId, offeringId } = seed(old);
      const project = createProject(
        ownerId,
        {
          offeringId,
          name: "Existente",
          language: "other",
          ignorePreset: "other",
        },
        old,
      );
      old.sqlite
        .prepare(
          "INSERT INTO project_versions(project_id,version_number,archive_drive_file_id,manifest_json,created_by_user_id) VALUES(?,1,'archive','[]',?)",
        )
        .run(project.id, ownerId);
      old.sqlite
        .prepare(
          "INSERT INTO project_files(project_id,relative_path,sha256,size_bytes,drive_file_id) VALUES(?,'main.txt','hash',4,'file')",
        )
        .run(project.id);
      const versions = old.sqlite
          .prepare("SELECT * FROM project_versions")
          .all(),
        files = old.sqlite.prepare("SELECT * FROM project_files").all();
      applyMigration(old, "0016_personal_projects.sql");
      expect(getUserProject(ownerId, project.id, old).offeringId).toBe(
        offeringId,
      );
      expect(
        old.sqlite.prepare("SELECT * FROM project_versions").all(),
      ).toEqual(versions);
      expect(old.sqlite.prepare("SELECT * FROM project_files").all()).toEqual(
        files,
      );
      expect(
        createProject(
          ownerId,
          { name: "Novo pessoal", language: "other", ignorePreset: "other" },
          old,
        ).offeringId,
      ).toBeNull();
      expect(old.sqlite.pragma("foreign_key_check")).toEqual([]);
      expect(old.sqlite.pragma("integrity_check")).toEqual([
        { integrity_check: "ok" },
      ]);
    } finally {
      old.close();
    }
  });
  it("stores personal project files under a user-specific path in the institution root", async () => {
    const { ownerId } = seed(connection);
    const project = createProject(
      ownerId,
      { name: "Meu projeto", language: "other", ignorePreset: "other" },
      connection,
    );
    const preview = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: null,
        files: [{ path: "main.txt", data: Buffer.from("demo") }],
      },
      connection,
    );
    const names: string[] = [];
    let id = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (init?.method === "GET") return Response.json({ files: [] });
      if (String(input).includes("/upload/"))
        return Response.json({ id: `upload-${++id}`, name: "file" });
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        names.push(body.name);
        return Response.json({
          id: `folder-${++id}`,
          name: body.name,
          mimeType: "application/vnd.google-apps.folder",
        });
      }
      return Response.json({}, { status: 500 });
    });
    await confirmProjectUpload(ownerId, preview.token, null, {
      connection,
      fetchImpl,
    });
    expect(names.slice(0, 5)).toEqual([
      "Instituição Teste - OSH",
      "Pessoais",
      `Pessoa-${ownerId}`,
      "Projetos",
      "Meu projeto",
    ]);
    expect(
      getUserProject(ownerId, project.id, connection).currentVersionNumber,
    ).toBe(1);
  });
  it("usa Drive central para novo projeto V2 e preserva o dono de projeto já vinculado", () => {
    const previous = process.env.OPENSTUDYHUB_V2_ENABLED;
    process.env.OPENSTUDYHUB_V2_ENABLED = "1";
    try {
      const { ownerId, otherId, offeringId } = seed(connection);
      vi.mocked(resolveDriveStorageUser).mockReturnValue(otherId);
      const project = createProject(
        ownerId,
        {
          offeringId,
          name: "Projeto V2",
          language: "other",
          ignorePreset: "other",
        },
        connection,
      );
      expect(getProjectDriveStorageUser(project, connection)).toBe(otherId);
      expect(resolveDriveStorageUser).toHaveBeenCalledWith(ownerId, null, {
        connection,
      });

      connection.sqlite
        .prepare("INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?)")
        .run(`project.storage_user.${project.id}`, String(otherId), Date.now());
      expect(getProjectDriveStorageUser(project, connection)).toBe(otherId);

      connection.sqlite
        .prepare("DELETE FROM app_settings WHERE key=?")
        .run(`project.storage_user.${project.id}`);
      connection.sqlite
        .prepare(
          "UPDATE projects SET drive_project_folder_id='existing' WHERE id=?",
        )
        .run(project.id);
      expect(
        getProjectDriveStorageUser(
          getUserProject(ownerId, project.id, connection),
          connection,
        ),
      ).toBe(ownerId);
    } finally {
      if (previous === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
      else process.env.OPENSTUDYHUB_V2_ENABLED = previous;
    }
  });
  it("permite editar stack somente ao dono sem alterar versões", () => {
    const { ownerId, otherId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      { offeringId, name: "Stack", language: "other", ignorePreset: "other" },
      connection,
    );
    expect(
      updateProjectTechnology(
        ownerId,
        project.id,
        { language: "python", technologies: ["python", "python", "go"] },
        connection,
      ),
    ).toMatchObject({
      language: "python",
      technologies: ["python", "go"],
      currentVersionNumber: 0,
    });
    expect(() =>
      updateProjectTechnology(
        otherId,
        project.id,
        { language: "java", technologies: [] },
        connection,
      ),
    ).toThrow();
  });

  it("prepara v1 com hashes server-side e lista ignores sem persistir corpos", async () => {
    const { ownerId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto",
        language: "javascript-typescript",
        ignorePreset: "javascript-typescript",
      },
      connection,
    );
    const preview = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: null,
        files: [
          { path: "src/index.ts", data: Buffer.from("export {}") },
          { path: ".env", data: Buffer.from("SECRET=private") },
        ],
      },
      connection,
    );
    expect(preview.diff.added).toEqual(["src/index.ts"]);
    expect(preview.ignored[0].path).toBe(".env");
    expect(
      connection.sqlite
        .prepare("select count(*) as count from project_files")
        .get(),
    ).toEqual({ count: 0 });
    await cancelProjectUploadPreview(ownerId, preview.token, connection);
  });

  it("bloqueia preview quando a versão-base está stale", async () => {
    const { ownerId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto",
        language: "other",
        ignorePreset: "other",
      },
      connection,
    );
    connection.sqlite
      .prepare("update projects set current_version_number = 2 where id = ?")
      .run(project.id);
    await expect(
      prepareProjectUpload(
        ownerId,
        project.id,
        {
          baseVersionNumber: 1,
          files: [{ path: "main.txt", data: Buffer.from("demo") }],
        },
        connection,
      ),
    ).rejects.toBeInstanceOf(ProjectConflictError);
  });

  it("confirma v1 no Drive e persiste somente metadados após sucesso remoto", async () => {
    const { ownerId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto",
        language: "other",
        ignorePreset: "other",
      },
      connection,
    );
    const preview = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: null,
        files: [
          {
            path: "src/main.txt",
            data: Buffer.from("demo"),
            mimeType: "text/plain",
          },
        ],
      },
      connection,
    );
    let nextId = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (init?.method === "GET" && url.includes("q=")) {
        return Response.json({ files: [] });
      }
      if (url.includes("/upload/drive/v3/files")) {
        nextId += 1;
        return Response.json({ id: `upload-${nextId}`, name: "file" });
      }
      if (init?.method === "POST") {
        nextId += 1;
        return Response.json({
          id: `folder-${nextId}`,
          name: "folder",
          mimeType: "application/vnd.google-apps.folder",
        });
      }
      return Response.json({}, { status: 500 });
    });

    await confirmProjectUpload(ownerId, preview.token, "Primeira versão", {
      connection,
      fetchImpl,
      language: "javascript-typescript",
      technologies: ["typescript", "react"],
    });

    expect(getUserProject(ownerId, project.id, connection)).toMatchObject({
      currentVersionNumber: 1,
      syncStatus: "complete",
      language: "javascript-typescript",
      technologies: ["typescript", "react"],
    });
    expect(
      connection.sqlite
        .prepare("select count(*) as count from project_files")
        .get(),
    ).toEqual({ count: 1 });
    expect(
      connection.sqlite
        .prepare("select count(*) as count from project_versions")
        .get(),
    ).toEqual({ count: 1 });
    expect(
      connection.sqlite
        .prepare("select mime_type as mimeType from project_files")
        .get(),
    ).toEqual({ mimeType: "text/plain" });
  });

  it("aplica adição, modificação e remoção na Current ao criar v2", async () => {
    const { ownerId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto incremental",
        language: "other",
        ignorePreset: "other",
      },
      connection,
    );
    let nextId = 0;
    const requests: Array<{ method: string; url: string }> = [];
    const folderParents = new Map<string, string>();
    const folderNames = new Map<string, string>();
    const createdFolderNames: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ method, url });
      if (method === "GET" && url.includes("?fields=") && !url.includes("q=")) {
        const id = new URL(url).pathname.split("/").at(-1)!;
        return Response.json({
          id,
          name: folderNames.get(id) ?? "folder",
          mimeType: "application/vnd.google-apps.folder",
          parents: [folderParents.get(id) ?? "root"],
        });
      }
      if (method === "GET" && url.includes("q=")) {
        return Response.json({ files: [] });
      }
      if (url.includes("/upload/drive/v3/files")) {
        nextId += 1;
        return Response.json({ id: `upload-${nextId}`, name: "file" });
      }
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)) as {
          name: string;
          parents?: string[];
        };
        nextId += 1;
        folderParents.set(`folder-${nextId}`, body.parents?.[0] ?? "root");
        folderNames.set(`folder-${nextId}`, body.name);
        createdFolderNames.push(body.name);
        return Response.json({
          id: `folder-${nextId}`,
          name: body.name,
          mimeType: "application/vnd.google-apps.folder",
        });
      }
      if (method === "PATCH") {
        const target = new URL(url);
        if (target.searchParams.has("addParents"))
          folderParents.set(
            target.pathname.split("/").at(-1)!,
            target.searchParams.get("addParents")!,
          );
        return Response.json({ id: "patched" });
      }
      return Response.json({}, { status: 500 });
    });

    const v1 = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: null,
        files: [
          { path: "keep.txt", data: Buffer.from("same") },
          { path: "modify.txt", data: Buffer.from("before") },
          { path: "remove.txt", data: Buffer.from("remove") },
        ],
      },
      connection,
    );
    await confirmProjectUpload(ownerId, v1.token, null, {
      connection,
      fetchImpl,
    });
    const originalProjectFolderId = getUserProject(
      ownerId,
      project.id,
      connection,
    ).driveProjectFolderId;
    folderParents.set(originalProjectFolderId!, "old-parent");
    const v2 = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: 1,
        files: [
          { path: "keep.txt", data: Buffer.from("same") },
          { path: "modify.txt", data: Buffer.from("after") },
          { path: "add.txt", data: Buffer.from("new") },
        ],
      },
      connection,
    );
    await confirmProjectUpload(ownerId, v2.token, "Segunda versão", {
      connection,
      fetchImpl,
    });

    expect(getUserProject(ownerId, project.id, connection)).toMatchObject({
      currentVersionNumber: 2,
      syncStatus: "complete",
      driveProjectFolderId: originalProjectFolderId,
    });
    expect(createdFolderNames.slice(0, 5)).toEqual([
      "Instituição Teste - OSH",
      "Projetos - ADS",
      "2030.1",
      "Subject",
      "Projeto incremental",
    ]);
    expect(folderParents.get("folder-2")).toBe("folder-1");
    expect(
      createdFolderNames.filter((name) => name === "Projeto incremental"),
    ).toHaveLength(1);
    expect(
      requests.some(
        ({ method, url }) =>
          method === "PATCH" && new URL(url).searchParams.has("addParents"),
      ),
    ).toBe(true);
    expect(
      connection.sqlite
        .prepare(
          `select added_count as addedCount, modified_count as modifiedCount,
                  removed_count as removedCount
           from project_versions where version_number = 2`,
        )
        .get(),
    ).toEqual({ addedCount: 1, modifiedCount: 1, removedCount: 1 });
    expect(
      connection.sqlite
        .prepare(
          "select relative_path as path from project_files order by path",
        )
        .all(),
    ).toEqual([
      { path: "add.txt" },
      { path: "keep.txt" },
      { path: "modify.txt" },
    ]);
    expect(
      requests.some(
        ({ method, url }) =>
          method === "PATCH" && url.includes("/upload/drive/v3/files/"),
      ),
    ).toBe(false);
    expect(
      requests.some(
        ({ method, url }) =>
          method === "PATCH" &&
          url.includes("www.googleapis.com/drive/v3/files/") &&
          !url.includes("/upload/"),
      ),
    ).toBe(true);
  });

  it("não marca versão completa quando o Drive falha", async () => {
    const { ownerId, offeringId } = seed(connection);
    const project = createProject(
      ownerId,
      {
        offeringId,
        name: "Projeto",
        language: "other",
        ignorePreset: "other",
      },
      connection,
    );
    const preview = await prepareProjectUpload(
      ownerId,
      project.id,
      {
        baseVersionNumber: null,
        files: [{ path: "main.txt", data: Buffer.from("demo") }],
      },
      connection,
    );
    await expect(
      confirmProjectUpload(ownerId, preview.token, null, {
        connection,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          Response.json({}, { status: 503 }),
        ),
      }),
    ).rejects.toThrow();
    expect(getUserProject(ownerId, project.id, connection)).toMatchObject({
      currentVersionNumber: 0,
      syncStatus: "failed",
    });
    expect(getProjectSyncFailureStage(project.id, connection)).toBe(
      "criação das pastas no Drive",
    );
    expect(getProjectRetryPreview(ownerId, project.id, connection)?.token).toBe(
      preview.token,
    );
    expect(
      connection.sqlite
        .prepare("select count(*) as count from project_versions")
        .get(),
    ).toEqual({ count: 0 });
    await cancelProjectUploadPreview(ownerId, preview.token, connection);
  });
});
