import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openV2Database, migrateV2 } from "./database";
import {
  createLocalDocument,
  deleteLocalDocument,
  getLocalDocument,
  setLocalDocumentShare,
  listSharedLocalDocuments,
} from "./local-documents";

vi.mock("@/lib/collaboration", () => ({
  listVisibleUsers: () => [{ id: 42, displayName: "B" }],
  listUserStudyGroups: (userId: number) =>
    userId === 41 || userId === 42 ? [{ id: 7 }] : [],
}));

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

describe("private local documents", () => {
  it("validates files and prevents another user from reading or deleting them", () => {
    const directory = mkdtempSync(join(tmpdir(), "osh-local-documents-"));
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

    const documentId = createLocalDocument(
      41,
      "Resumo.txt",
      Buffer.from("Conteúdo fictício."),
    );
    expect(getLocalDocument(41, documentId)?.content.toString()).toBe(
      "Conteúdo fictício.",
    );
    expect(getLocalDocument(42, documentId)).toBeNull();
    setLocalDocumentShare(41, documentId, "person", 42, true);
    expect(getLocalDocument(42, documentId)?.content.toString()).toBe(
      "Conteúdo fictício.",
    );
    expect(listSharedLocalDocuments(42).map((item) => item.id)).toContain(
      documentId,
    );
    setLocalDocumentShare(41, documentId, "person", 42, false);
    expect(getLocalDocument(42, documentId)).toBeNull();
    setLocalDocumentShare(41, documentId, "group", 7, true);
    expect(getLocalDocument(42, documentId)?.content.toString()).toBe(
      "Conteúdo fictício.",
    );
    setLocalDocumentShare(41, documentId, "group", 7, false);
    expect(getLocalDocument(42, documentId)).toBeNull();
    expect(() =>
      setLocalDocumentShare(42, documentId, "person", 41, true),
    ).toThrow();
    expect(() => deleteLocalDocument(42, documentId)).toThrow();
    expect(() =>
      createLocalDocument(41, "script.js", Buffer.from("alert(1)")),
    ).toThrow();
    expect(() =>
      createLocalDocument(
        41,
        "arquivo.docx",
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
      ),
    ).toThrow();
    expect(() =>
      createLocalDocument(41, "grande.txt", Buffer.alloc(10 * 1024 * 1024 + 1)),
    ).toThrow();
    deleteLocalDocument(41, documentId);
    expect(getLocalDocument(41, documentId)).toBeNull();
  });
});
