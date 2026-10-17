import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../db/client";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import { adminActor, userActor } from "./actor";
const mocks = vi.hoisted(() => ({
  restore: vi.fn(),
  root: vi.fn(),
  folder: vi.fn(),
}));
vi.mock("../google/drive", () => ({
  restoreDriveFolderForUser: mocks.restore,
  ensureDriveRootFolder: mocks.root,
  ensureDriveFolderForUser: mocks.folder,
}));
vi.mock("./drive-storage", () => ({
  storageOwnerStatus: () => ({ connected: true, ownerId: 3 }),
}));
vi.mock("../storage-layout", () => ({
  getStorageLayout: () => ({}),
  getOfferingStorageContextById: () => ({}),
  buildOfferingStoragePath: () => ["Institute", "Subject"],
}));
import { provisionPendingDriveFolders } from "./drive-folders";
let legacy: ReturnType<typeof createDatabase>;
let db: ReturnType<typeof openV2Database>;
beforeEach(() => {
  vi.clearAllMocks();
  legacy = createDatabase(":memory:");
  legacy.sqlite
    .exec(`CREATE TABLE subject_offerings(id INTEGER PRIMARY KEY,status TEXT);INSERT INTO subject_offerings VALUES(1,'active');
 CREATE TABLE offering_google_integrations(offering_id INTEGER PRIMARY KEY,drive_folder_id TEXT,drive_folder_name TEXT,drive_storage_user_id INTEGER,updated_at INTEGER,updated_by_user_id INTEGER,notebook_url TEXT,classroom_course_id TEXT,classroom_course_name TEXT);
 INSERT INTO offering_google_integrations(offering_id,drive_folder_id,drive_folder_name,drive_storage_user_id,classroom_course_id) VALUES(1,'old-folder','Old folder',30,'classroom-kept');
 CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT,updated_at INTEGER);`);
  db = openV2Database(":memory:");
  migrateV2(db);
  seedV2Fake(db);
  db.prepare(
    "INSERT OR REPLACE INTO legacy_user_links(user_id,legacy_user_id) VALUES(3,30)",
  ).run();
  mocks.root.mockResolvedValue({ id: "new-root", name: "Root" });
  mocks.restore.mockImplementation(async (_u, id) => ({
    exists: id !== "old-folder",
    restored: false,
  }));
  mocks.folder.mockImplementation(async (_u, input) => ({
    id: "new-" + input.name,
    name: input.name,
  }));
});
afterEach(() => {
  legacy.close();
  db.close();
});
describe("recover offering folders after central root replacement", () => {
  it("keeps a missing reference unless explicit recreation was requested", async () => {
    await expect(
      provisionPendingDriveFolders(db, adminActor(1), { connection: legacy }),
    ).rejects.toThrow("Recriar pastas ausentes");
    expect(mocks.folder).not.toHaveBeenCalled();
    expect(
      legacy.sqlite
        .prepare("SELECT drive_folder_id id FROM offering_google_integrations")
        .get(),
    ).toEqual({ id: "old-folder" });
  });
  it("recreates missing paths, keeps previous references and Classroom, then reuses the result", async () => {
    const result = await provisionPendingDriveFolders(db, adminActor(1), {
      connection: legacy,
      recreateMissing: true,
    });
    expect(result).toMatchObject({
      checked: 1,
      created: 1,
      recreated: 1,
      remaining: 0,
    });
    expect(mocks.folder).toHaveBeenCalledTimes(2);
    expect(
      legacy.sqlite
        .prepare(
          "SELECT drive_folder_id id,classroom_course_id classroom FROM offering_google_integrations",
        )
        .get(),
    ).toEqual({ id: "new-Subject", classroom: "classroom-kept" });
    const history = legacy.sqlite
      .prepare("SELECT value FROM app_settings")
      .get() as { value: string };
    expect(JSON.parse(history.value).driveFolderId).toBe("old-folder");
    expect(
      await provisionPendingDriveFolders(db, adminActor(1), {
        connection: legacy,
        recreateMissing: true,
      }),
    ).toMatchObject({ created: 0, recreated: 0 });
    expect(mocks.folder).toHaveBeenCalledTimes(2);
  });
  it("restores an original trashed folder without replacing its reference", async () => {
    mocks.restore.mockResolvedValue({ exists: true, restored: true });
    expect(
      await provisionPendingDriveFolders(db, adminActor(1), {
        connection: legacy,
      }),
    ).toMatchObject({ restored: 1, created: 0 });
    expect(mocks.folder).not.toHaveBeenCalled();
  });
  it("never recreates folders when access or the provider fails, or for a normal user", async () => {
    mocks.restore.mockRejectedValue(new Error("Sem permissão"));
    await expect(
      provisionPendingDriveFolders(db, adminActor(1), {
        connection: legacy,
        recreateMissing: true,
      }),
    ).rejects.toThrow("Sem permissão");
    await expect(
      provisionPendingDriveFolders(db, userActor(3), {
        connection: legacy,
        recreateMissing: true,
      }),
    ).rejects.toThrow("Admin");
    expect(mocks.folder).not.toHaveBeenCalled();
  });
});
