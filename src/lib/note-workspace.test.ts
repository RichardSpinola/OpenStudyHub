import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createMigratedTestDatabase } from "@/lib/test-database";
import type { DatabaseConnection } from "@/lib/db/client";
import {
  createNote,
  getUserNote,
  getReadableNote,
  moveNote,
  updateNote,
  deleteNote,
} from "@/lib/notes";
import { setNotePersonShare } from "@/lib/collaboration";
import {
  initializeNoteWorkspace,
  mergeNoteWorkspace,
  copyNoteWorkspace,
  listNoteVersions,
  importNoteWorkspace,
} from "@/lib/note-workspace";
import { readNoteDatabases, noteDatabasesMarkdown } from "@/lib/note-databases";

function apply(state: string) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(state, "base64"));
  return doc;
}
function seed(db: DatabaseConnection) {
  const insert = db.sqlite.prepare(
    "insert into users(display_name,login,password_hash,role,active,password_changed_at,created_at,updated_at) values(?,?,'hash','member',1,1,1,1)",
  );
  return {
    a: Number(insert.run("Ana", "ana").lastInsertRowid),
    b: Number(insert.run("Bia", "bia").lastInsertRowid),
    c: Number(insert.run("Caio", "caio").lastInsertRowid),
  };
}
describe("stage 5 note workspace", () => {
  let db: DatabaseConnection;
  beforeEach(() => {
    db = createMigratedTestDatabase();
  });
  afterEach(() => db.close());
  it("migrates Markdown only once and prevents stale legacy saves", async () => {
    const { a } = seed(db);
    const note = createNote(
      a,
      { title: "Resumo", content: "## Conceitos\n\n**Texto**\n\n- [ ] Tarefa" },
      db,
    );
    const [first, second] = await Promise.all([
      initializeNoteWorkspace(a, note.id, db),
      initializeNoteWorkspace(a, note.id, db),
    ]);
    expect(second.state).toBe(first.state);
    expect(() =>
      updateNote(a, note.id, { title: "antiga", content: "apagado" }, db),
    ).toThrow("workspace editor");
    const doc = apply(first.state);
    doc.getText("title").insert(6, " da aula");
    const result = mergeNoteWorkspace(
      a,
      note.id,
      Y.encodeStateAsUpdate(doc),
      db,
    );
    doc.destroy();
    expect(result.revision).toBe(1);
    expect(getUserNote(a, note.id, db).content).toContain("Conceitos");
    expect(getUserNote(a, note.id, db).content).toContain("Tarefa");
  });
  it("merges two users editing the same title concurrently, retries idempotently and survives reload", async () => {
    const { a, b } = seed(db);
    const note = createNote(a, { title: "Aula" }, db);
    setNotePersonShare(a, note.id, b, true, db, true);
    const initial = await initializeNoteWorkspace(a, note.id, db),
      one = apply(initial.state),
      two = apply(initial.state);
    one.getText("title").insert(4, " Ana");
    two.getText("title").insert(0, "Bia ");
    const first = mergeNoteWorkspace(
      a,
      note.id,
      Y.encodeStateAsUpdate(one),
      db,
    );
    const merged = mergeNoteWorkspace(
      b,
      note.id,
      Y.encodeStateAsUpdate(two),
      db,
    );
    const latest = apply(merged.state);
    expect(latest.getText("title").toString()).toBe("Bia Aula Ana");
    expect(
      mergeNoteWorkspace(b, note.id, Y.encodeStateAsUpdate(two), db).revision,
    ).toBe(merged.revision);
    expect(merged.revision).toBeGreaterThan(first.revision);
    expect((await initializeNoteWorkspace(a, note.id, db)).state).toBe(
      merged.state,
    );
    one.destroy();
    two.destroy();
    latest.destroy();
  });
  it("merges concurrent edits inside the same paragraph without replacing text", async () => {
    const { a, b } = seed(db),
      note = createNote(a, { title: "Texto", content: "conteúdo" }, db);
    setNotePersonShare(a, note.id, b, true, db, true);
    const initial = await initializeNoteWorkspace(a, note.id, db),
      one = apply(initial.state),
      two = apply(initial.state);
    function firstText(node: Y.XmlFragment): Y.XmlText | undefined {
      for (const child of node.toArray()) {
        if (child instanceof Y.XmlText) return child;
        if (child instanceof Y.XmlElement) {
          const nested = firstText(child);
          if (nested) return nested;
        }
      }
    }
    const textA = firstText(one.getXmlFragment("document-store"))!,
      textB = firstText(two.getXmlFragment("document-store"))!;
    expect(textA).toBeDefined();
    textA.insert(0, "Ana ");
    textB.insert(textB.length, " Bia");
    mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(one), db);
    mergeNoteWorkspace(b, note.id, Y.encodeStateAsUpdate(two), db);
    expect(getUserNote(a, note.id, db).content).toContain("Ana conteúdo Bia");
    one.destroy();
    two.destroy();
  });
  it("keeps readers, revoked people and outsiders from changing content", async () => {
    const { a, b, c } = seed(db),
      note = createNote(a, { title: "Privada" }, db);
    await initializeNoteWorkspace(a, note.id, db);
    setNotePersonShare(a, note.id, b, true, db);
    expect(getReadableNote(b, note.id, db).editable).toBe(false);
    const state = await initializeNoteWorkspace(b, note.id, db),
      doc = apply(state.state);
    doc.getText("title").insert(0, "X");
    expect(() =>
      mergeNoteWorkspace(b, note.id, Y.encodeStateAsUpdate(doc), db),
    ).toThrow("leitura");
    expect(() =>
      mergeNoteWorkspace(c, note.id, Y.encodeStateAsUpdate(doc), db),
    ).toThrow("not found");
    setNotePersonShare(a, note.id, b, true, db, true);
    expect(getReadableNote(b, note.id, db).editable).toBe(true);
    setNotePersonShare(a, note.id, b, false, db);
    expect(() =>
      mergeNoteWorkspace(b, note.id, Y.encodeStateAsUpdate(doc), db),
    ).toThrow("not found");
    expect(getUserNote(a, note.id, db).title).toBe("Privada");
    doc.destroy();
  });
  it("preserves independent database cells and exports the same records across views", async () => {
    const { a } = seed(db),
      note = createNote(a, { title: "Pesquisa" }, db),
      initial = await initializeNoteWorkspace(a, note.id, db);
    const one = apply(initial.state),
      two = apply(initial.state),
      id = crypto.randomUUID(),
      row = crypto.randomUUID(),
      field = crypto.randomUUID();
    one.getMap("database").set(`db:${id}`, "Pesquisa");
    one.getMap("database").set(`row:${id}:${row}`, "1");
    one.getMap("database").set(`cell:${id}:${row}:name`, "Artigo");
    const base = mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(one), db);
    Y.applyUpdate(two, Buffer.from(base.state, "base64"));
    one
      .getMap("database")
      .set(
        `field:${id}:${field}`,
        JSON.stringify({ id: field, name: "Prazo", type: "date" }),
      );
    one.getMap("database").set(`cell:${id}:${row}:${field}`, "2030-01-20");
    two.getMap("database").set(`cell:${id}:${row}:status`, "done");
    mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(one), db);
    const last = mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(two), db),
      doc = apply(last.state);
    const data = doc.getMap<string>("database").toJSON();
    expect(readNoteDatabases(data)[0].rows[0]).toMatchObject({
      name: "Artigo",
      status: "done",
      cells: { [field]: "2030-01-20" },
    });
    expect(noteDatabasesMarkdown(data)).toContain(
      "Artigo | Concluído | 2030-01-20",
    );
    expect(getUserNote(a, note.id, db).content).toContain("Artigo");
    one.destroy();
    two.destroy();
    doc.destroy();
  });
  it("recovers a private copy from history and imports an offline draft", async () => {
    const { a, b } = seed(db),
      note = createNote(a, { title: "Original", content: "Texto inicial" }, db),
      initial = await initializeNoteWorkspace(a, note.id, db);
    const doc = apply(initial.state);
    doc.getText("title").insert(8, " revisado");
    mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(doc), db);
    const versions = listNoteVersions(a, note.id, db);
    expect(versions).toHaveLength(1);
    const copy = copyNoteWorkspace(a, note.id, versions[0].revision, db);
    expect(copy.content).toContain("Texto inicial");
    expect(copy.title).toContain("cópia");
    expect(() => getReadableNote(b, copy.id, db)).toThrow("not found");
    doc.getText("title").insert(0, "Offline ");
    const imported = importNoteWorkspace(
      a,
      "draft.json",
      JSON.stringify({
        format: "openstudyhub-note",
        state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
      }),
      db,
    );
    expect(imported.title).toContain("Offline");
    expect(getUserNote(a, note.id, db).title).not.toContain("Offline");
    doc.destroy();
  });
  it("rejects cycles and foreign parent pages, keeps subpages when a parent is removed", () => {
    const { a, b } = seed(db),
      root = createNote(a, { title: "Raiz" }, db),
      child = createNote(a, { title: "Filha", parentNoteId: root.id }, db),
      foreign = createNote(b, { title: "Outra" }, db);
    expect(() => moveNote(a, root.id, child.id, db)).toThrow("dela mesma");
    expect(() => moveNote(a, root.id, foreign.id, db)).toThrow("not found");
    deleteNote(a, root.id, db);
    expect(getUserNote(a, child.id, db).parentNoteId).toBeNull();
  });
  it("rejects corrupt and oversized updates without modifying the stored copy", async () => {
    const { a } = seed(db),
      note = createNote(a, { title: "Boa" }, db),
      initial = await initializeNoteWorkspace(a, note.id, db);
    expect(() =>
      mergeNoteWorkspace(a, note.id, new Uint8Array([255, 255]), db),
    ).toThrow();
    const doc = apply(initial.state);
    doc.getText("title").insert(0, "x".repeat(181));
    expect(() =>
      mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(doc), db),
    ).toThrow("180");
    expect((await initializeNoteWorkspace(a, note.id, db)).state).toBe(
      initial.state,
    );
    doc.destroy();
  });
});
