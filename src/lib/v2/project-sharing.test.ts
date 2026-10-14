import { expect, it, vi } from "vitest";
import { createMigratedTestDatabase } from "../test-database";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  setProjectShare,
  sharedProjectIds,
  sharedProjectIdsIn,
} from "./project-sharing";
import {
  createProject,
  getUserProject,
  updateProjectTechnology,
  archiveUserProject,
} from "../projects";
vi.mock("./project-sharing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./project-sharing")>();
  return { ...actual, sharedProjectIds: vi.fn(() => []) };
});
it("shares for reading, denies recipient writes and owner impersonation, and revokes access", () => {
  const legacy = createMigratedTestDatabase(),
    db = openV2Database(":memory:");
  try {
    migrateV2(db);
    seedV2Fake(db);
    legacy.sqlite
      .prepare(
        "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(10,'A','a','fake','member'),(20,'B','b','fake','member')",
      )
      .run();
    db.prepare(
      "INSERT INTO legacy_user_links(user_id,legacy_user_id) VALUES(3,10),(4,20)",
    ).run();
    const project = createProject(
      10,
      {
        offeringId: null,
        name: "Share test",
        language: "other",
        ignorePreset: "other",
      },
      legacy,
    );
    setProjectShare(db, legacy, 10, project.id, 20, true);
    setProjectShare(db, legacy, 10, project.id, 20, true);
    expect(db.prepare("SELECT * FROM project_shares_v2").all()).toHaveLength(1);
    expect(sharedProjectIdsIn(db, 20)).toEqual([project.id]);
    db.prepare("UPDATE users SET active=0 WHERE id=4").run();
    expect(sharedProjectIdsIn(db, 20)).toEqual([]);
    db.prepare("UPDATE users SET active=1 WHERE id=4").run();
    vi.mocked(sharedProjectIds).mockImplementation((id) =>
      id === 20 ? [project.id] : [],
    );
    expect(getUserProject(20, project.id, legacy).name).toBe("Share test");
    expect(() => archiveUserProject(20, project.id, legacy)).toThrow(
      "somente para leitura",
    );
    expect(() =>
      updateProjectTechnology(
        20,
        project.id,
        { language: "other", technologies: [] },
        legacy,
      ),
    ).toThrow("somente para leitura");
    expect(() => setProjectShare(db, legacy, 20, project.id, 10, true)).toThrow(
      "Somente o proprietário",
    );
    setProjectShare(db, legacy, 10, project.id, 20, false);
    vi.mocked(sharedProjectIds).mockReturnValue([]);
    expect(() => getUserProject(20, project.id, legacy)).toThrow("not found");
    expect(db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.close();
    legacy.close();
  }
});
