import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openV2Database, migrateV2 } from "./database";
import {
  addProfileLink,
  deleteProfileLink,
  listProfileLinks,
} from "./profile-links";

const previousEnabled = process.env.OPENSTUDYHUB_V2_ENABLED;
const previousPath = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
const directories: string[] = [];
afterEach(() => {
  if (previousEnabled === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
  else process.env.OPENSTUDYHUB_V2_ENABLED = previousEnabled;
  if (previousPath === undefined)
    delete process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
  else process.env.OPENSTUDYHUB_V2_DATABASE_PATH = previousPath;
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("profile public links", () => {
  it("isolates owners and rejects unsafe URLs", () => {
    const directory = mkdtempSync(join(tmpdir(), "osh-profile-links-"));
    directories.push(directory);
    const path = join(directory, "test.db");
    const db = openV2Database(path);
    migrateV2(db);
    db.prepare(
      "INSERT INTO users(id,login,display_name,password_hash) VALUES(1,'a.fake','A','hash'),(2,'b.fake','B','hash')",
    ).run();
    db.prepare(
      "INSERT INTO legacy_user_links(user_id,legacy_user_id,linked_at) VALUES(1,41,1),(2,42,1)",
    ).run();
    db.close();
    process.env.OPENSTUDYHUB_V2_ENABLED = "1";
    process.env.OPENSTUDYHUB_V2_DATABASE_PATH = path;

    addProfileLink(41, "Portfólio", "https://example.org/portfolio");
    expect(listProfileLinks(41)).toMatchObject([
      { label: "Portfólio", url: "https://example.org/portfolio" },
    ]);
    expect(listProfileLinks(42)).toEqual([]);
    expect(() =>
      addProfileLink(41, "Inseguro", "javascript:alert(1)"),
    ).toThrow();
    expect(() =>
      addProfileLink(41, "Local", "https://localhost/private"),
    ).toThrow();
    deleteProfileLink(42, listProfileLinks(41)[0].id);
    expect(listProfileLinks(41)).toHaveLength(1);
    deleteProfileLink(41, listProfileLinks(41)[0].id);
    expect(listProfileLinks(41)).toEqual([]);
  });
});
