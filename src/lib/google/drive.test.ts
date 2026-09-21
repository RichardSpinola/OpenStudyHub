import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  copyDriveFile,
  createOfferingDriveFolder,
  getDriveFileMetadata,
  listDriveFolderItems,
  trashDriveFile,
} from "./drive";
import { getGoogleAccessToken } from "./oauth";

vi.mock("./oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "access-token"),
}));

function academicFolderFetch(prefix = "folder") {
  return vi.fn<typeof fetch>(async (_input, init) => {
    if ((init?.method ?? "GET") === "GET") {
      return Response.json({ files: [] });
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as { name?: string };
    const slug = (body.name ?? "folder")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, "");
    return Response.json({
      id: `${prefix}-${slug || "folder"}`,
      name: body.name ?? "Folder",
      mimeType: "application/vnd.google-apps.folder",
    });
  });
}

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const adminId = Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Admin', 'admin', 'hash', 'admin', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
  const userId = Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('User', 'user', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Program')")
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
    .prepare(
      `insert into google_connections
       (user_id, google_subject, account_email, encrypted_refresh_token,
        granted_scopes, status)
       values (?, 'admin-google', 'admin@example.test', 'encrypted',
               'drive.file', 'connected')`,
    )
    .run(adminId);
  return { adminId, userId, offeringId };
}

describe("Drive folder foundation", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    vi.mocked(getGoogleAccessToken).mockClear();
  });

  afterEach(() => connection.close());

  it("cria a hierarquia acadêmica da oferta uma única vez", async () => {
    const { adminId, offeringId } = seed(connection);
    const fetchImpl = academicFolderFetch();

    const created = await createOfferingDriveFolder(adminId, offeringId, {
      connection,
      fetchImpl,
    });
    const reused = await createOfferingDriveFolder(adminId, offeringId, {
      connection,
      fetchImpl,
    });

    expect(created).toMatchObject({ id: "folder-subject", name: "Subject" });
    expect(reused).toEqual({ id: "folder-subject", name: "Subject" });
    const createdNames = fetchImpl.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(
        ([, init]) => (JSON.parse(String(init?.body)) as { name: string }).name,
      );
    expect(createdNames).toEqual([
      "OpenStudyHub",
      "Program",
      "2030.1",
      "Subject",
    ]);
    expect(
      connection.sqlite
        .prepare(
          "select drive_root_folder_id as root from google_connections where user_id = ?",
        )
        .get(adminId),
    ).toEqual({ root: "folder-openstudyhub" });
  });

  it("usa o nome da instituição na pasta raiz quando configurado", async () => {
    const { adminId, offeringId } = seed(connection);
    connection.sqlite
      .prepare(
        `insert into app_settings (key, value, updated_at)
         values ('institution.display_name', 'Católica', ?)`,
      )
      .run(Date.now());
    const fetchImpl = academicFolderFetch("inst");

    await createOfferingDriveFolder(adminId, offeringId, {
      connection,
      fetchImpl,
    });

    const createdNames = fetchImpl.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(
        ([, init]) => (JSON.parse(String(init?.body)) as { name: string }).name,
      );
    expect(createdNames[0]).toBe("Católica - OSH");
  });

  it("autoriza antes da rede e lista com a conexão do usuário solicitante", async () => {
    const { userId, offeringId } = seed(connection);
    const blockedFetch = vi.fn<typeof fetch>();
    await expect(
      createOfferingDriveFolder(userId, offeringId, {
        connection,
        fetchImpl: blockedFetch,
      }),
    ).rejects.toThrow("Forbidden.");
    expect(blockedFetch).not.toHaveBeenCalled();

    const listFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ files: [{ id: "file-1", name: "Material.pdf" }] }),
      );
    expect(
      await listDriveFolderItems(userId, "folder-1", {
        connection,
        fetchImpl: listFetch,
      }),
    ).toEqual([{ id: "file-1", name: "Material.pdf" }]);
    expect(getGoogleAccessToken).toHaveBeenLastCalledWith(userId, {
      connection,
      fetchImpl: listFetch,
    });
  });

  it("não chama Drive quando a conexão do usuário está indisponível", async () => {
    const { adminId, offeringId } = seed(connection);
    vi.mocked(getGoogleAccessToken).mockRejectedValueOnce(
      new Error("Google account is not connected."),
    );
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      createOfferingDriveFolder(adminId, offeringId, {
        connection,
        fetchImpl,
      }),
    ).rejects.toThrow("Google account is not connected.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("usa a credencial central sem ampliar a autoridade do ator", async () => {
    const { adminId, userId, offeringId } = seed(connection);
    connection.sqlite
      .prepare(
        `insert into google_connections
         (user_id, google_subject, account_email, encrypted_refresh_token,
          granted_scopes, status)
         values (?, 'storage-google', 'storage@example.test', 'encrypted',
                 'drive.file', 'connected')`,
      )
      .run(userId);
    connection.sqlite
      .prepare(
        "insert into app_settings (key, value) values ('google.storage_owner_user_id', ?)",
      )
      .run(String(userId));
    const fetchImpl = academicFolderFetch("central");

    await createOfferingDriveFolder(adminId, offeringId, {
      connection,
      fetchImpl,
    });

    expect(getGoogleAccessToken).toHaveBeenCalledWith(userId, {
      connection,
      fetchImpl,
    });
    expect(
      connection.sqlite
        .prepare(
          "select drive_storage_user_id as storageUserId from offering_google_integrations where offering_id = ?",
        )
        .get(offeringId),
    ).toEqual({ storageUserId: userId });
  });

  it("consulta, copia para uma única pasta e descarta somente com o token do usuário", async () => {
    const { userId } = seed(connection);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          id: "source-doc",
          name: "Template",
          mimeType: "application/vnd.google-apps.document",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "copy-doc",
          name: "Documento",
          mimeType: "application/vnd.google-apps.document",
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "copy-doc", trashed: true }));

    await getDriveFileMetadata(userId, "source-doc", {
      connection,
      fetchImpl,
    });
    await copyDriveFile(
      userId,
      {
        sourceFileId: "source-doc",
        name: "Documento",
        parentFolderId: "offering-folder",
      },
      { connection, fetchImpl },
    );
    await trashDriveFile(userId, "copy-doc", { connection, fetchImpl });

    expect(getGoogleAccessToken).toHaveBeenCalledTimes(3);
    expect(getGoogleAccessToken).toHaveBeenNthCalledWith(2, userId, {
      connection,
      fetchImpl,
    });
    const copyRequest = fetchImpl.mock.calls[1];
    expect(String(copyRequest?.[0])).toContain("source-doc/copy");
    expect(JSON.parse(String(copyRequest?.[1]?.body))).toEqual({
      name: "Documento",
      parents: ["offering-folder"],
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({
      trashed: true,
    });
  });
});
