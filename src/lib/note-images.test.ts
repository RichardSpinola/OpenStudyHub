import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { ServerBlockNoteEditor } from "@blocknote/server-util";
import * as Y from "yjs";
import { createMigratedTestDatabase } from "@/lib/test-database";
import type { DatabaseConnection } from "@/lib/db/client";
import { createNote, deleteNote, getUserNote } from "@/lib/notes";
import { setNotePersonShare } from "@/lib/collaboration";
import { saveNoteImage, readNoteImage } from "@/lib/note-images";
import { noteImageId, noteImageMaxBytes } from "@/lib/note-image-url";
import { exportNoteAsHtml } from "@/lib/note-export";
import { noteBlockSchema } from "@/lib/note-block-schema";
import {
  copyNoteWorkspace,
  importNoteWorkspace,
  initializeNoteWorkspace,
  mergeNoteWorkspace,
} from "@/lib/note-workspace";

describe("private note images", () => {
  let db: DatabaseConnection;
  let a: number, b: number;
  beforeEach(() => {
    db = createMigratedTestDatabase();
    const insert = db.sqlite.prepare(
      "insert into users(display_name,login,password_hash,role,active,password_changed_at,created_at,updated_at) values(?,?,'hash','member',1,1,1,1)",
    );
    a = Number(insert.run("Ana", "ana").lastInsertRowid);
    b = Number(insert.run("Bia", "bia").lastInsertRowid);
  });
  afterEach(() => db.close());
  const png = () =>
    sharp({
      create: { width: 100, height: 60, channels: 4, background: "#38786d" },
    })
      .png()
      .toBuffer();
  it("normalizes an uploaded image, allows readers to view and revokes access immediately", async () => {
    const note = createNote(a, { title: "Aula" }, db),
      image = await saveNoteImage(a, note.id, await png(), db),
      id = noteImageId(image.url)!;
    expect(
      (await sharp(readNoteImage(a, id, db)!.data).metadata()).format,
    ).toBe("webp");
    expect(readNoteImage(b, id, db)).toBeNull();
    setNotePersonShare(a, note.id, b, true, db);
    expect(readNoteImage(b, id, db)?.data.length).toBeGreaterThan(0);
    await expect(saveNoteImage(b, note.id, await png(), db)).rejects.toThrow(
      "leitura",
    );
    setNotePersonShare(a, note.id, b, true, db, true);
    await expect(
      saveNoteImage(b, note.id, await png(), db),
    ).resolves.toMatchObject({ width: 100, height: 60 });
    setNotePersonShare(a, note.id, b, false, db);
    expect(readNoteImage(b, id, db)).toBeNull();
  });
  it("rejects forged formats, oversized uploads, excessive pixels and page limits", async () => {
    const note = createNote(a, { title: "Aula" }, db);
    await expect(
      saveNoteImage(
        a,
        note.id,
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
        ),
        db,
      ),
    ).rejects.toThrow("PNG");
    await expect(
      saveNoteImage(a, note.id, Buffer.alloc(noteImageMaxBytes + 1), db),
    ).rejects.toThrow("5 MB");
    await expect(
      saveNoteImage(a, note.id, Buffer.from("not an image"), db),
    ).rejects.toThrow("válida");
    const huge = await sharp({
      create: { width: 5000, height: 4001, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(saveNoteImage(a, note.id, huge, db)).rejects.toThrow(
      "megapixels",
    );
    const raw = await png();
    for (let i = 0; i < 50; i++) await saveNoteImage(a, note.id, raw, db);
    await expect(saveNoteImage(a, note.id, raw, db)).rejects.toThrow(
      "limite de imagens",
    );
  });
  it("keeps images in copies and recovered drafts and removes the final unused asset on deletion", async () => {
    const original = createNote(a, { title: "Com imagem" }, db),
      image = await saveNoteImage(a, original.id, await png(), db),
      id = noteImageId(image.url)!;
    const editor = ServerBlockNoteEditor.create({ schema: noteBlockSchema });
    const doc = editor.blocksToYDoc(
      [
        {
          type: "image",
          props: { url: image.url, caption: "Diagrama", previewWidth: 400 },
        },
        { type: "paragraph", content: "Explicação" },
      ],
      "document-store",
    );
    doc.getText("title").insert(0, "Com imagem");
    await initializeNoteWorkspace(a, original.id, db);
    // Replace the initial empty fragment, preserving the server's update identities.
    const state = await initializeNoteWorkspace(a, original.id, db),
      merged = new Y.Doc();
    Y.applyUpdate(merged, Buffer.from(state.state, "base64"));
    merged
      .getXmlFragment("document-store")
      .delete(0, merged.getXmlFragment("document-store").length);
    Y.applyUpdate(merged, Y.encodeStateAsUpdate(doc));
    mergeNoteWorkspace(a, original.id, Y.encodeStateAsUpdate(merged), db);
    expect(getUserNote(a, original.id, db).content).toContain(
      `![Diagrama](<${image.url}>)`,
    );
    const exported = exportNoteAsHtml(getUserNote(a, original.id, db), {
      [image.url]: `data:image/webp;base64,${readNoteImage(a, id, db)!.data.toString("base64")}`,
    });
    expect(exported).toContain('<img src="data:image/webp;base64,');
    const copy = copyNoteWorkspace(a, original.id, undefined, db);
    const json = JSON.stringify({
      format: "openstudyhub-note",
      state: Buffer.from(Y.encodeStateAsUpdate(merged)).toString("base64"),
    });
    const recovered = importNoteWorkspace(a, "draft.json", json, db);
    expect(() => importNoteWorkspace(b, "stolen.json", json, db)).toThrow(
      "imagem não está disponível",
    );
    deleteNote(a, original.id, db);
    expect(readNoteImage(a, id, db)?.data.length).toBeGreaterThan(0);
    deleteNote(a, copy.id, db);
    expect(readNoteImage(a, id, db)?.data.length).toBeGreaterThan(0);
    deleteNote(a, recovered.id, db);
    expect(readNoteImage(a, id, db)).toBeNull();
    expect(
      db.sqlite.prepare("select count(*) n from note_images").get(),
    ).toEqual({ n: 0 });
    doc.destroy();
    merged.destroy();
  });
  it("rejects executable image URLs without changing a saved page", async () => {
    const note = createNote(a, { title: "Segura" }, db),
      state = await initializeNoteWorkspace(a, note.id, db);
    const editor = ServerBlockNoteEditor.create({ schema: noteBlockSchema }),
      doc = editor.blocksToYDoc(
        [
          {
            type: "image",
            props: { url: "https://example.invalid/image.png" },
          },
        ],
        "document-store",
      );
    const candidate = new Y.Doc();
    Y.applyUpdate(candidate, Buffer.from(state.state, "base64"));
    const content = candidate.getXmlFragment("document-store");
    content.delete(0, content.length);
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
    function poison(node: Y.XmlFragment | Y.XmlElement) {
      if (node instanceof Y.XmlElement && node.nodeName === "image")
        node.setAttribute("url", "javascript:alert(1)");
      for (const child of node.toArray())
        if (child instanceof Y.XmlElement) poison(child);
    }
    poison(candidate.getXmlFragment("document-store"));
    expect(editor.yDocToBlocks(candidate, "document-store")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image",
          props: expect.objectContaining({ url: "javascript:alert(1)" }),
        }),
      ]),
    );
    expect(() =>
      mergeNoteWorkspace(a, note.id, Y.encodeStateAsUpdate(candidate), db),
    ).toThrow("HTTP");
    expect((await initializeNoteWorkspace(a, note.id, db)).state).toBe(
      state.state,
    );
    doc.destroy();
    candidate.destroy();
  });
});
