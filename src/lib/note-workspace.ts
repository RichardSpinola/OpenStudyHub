import { ServerBlockNoteEditor } from "@blocknote/server-util";
import * as Y from "yjs";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  createNote,
  getReadableNote,
  getUserNote,
  type NoteRecord,
} from "@/lib/notes";
import { noteBlockSchema } from "@/lib/note-block-schema";
import {
  noteDatabasesMarkdown,
  validateNoteDatabases,
} from "@/lib/note-databases";

const fragment = "document-store";
export const noteStateMaxBytes = 1_500_000;
let editor: ReturnType<typeof makeEditor> | undefined;
const makeEditor = () =>
  ServerBlockNoteEditor.create({ schema: noteBlockSchema });
function serverEditor() {
  return (editor ??= makeEditor());
}

type WorkspaceRow = { state: Buffer; revision: number; updatedAt: number };
export type NoteWorkspaceState = {
  state: string;
  vector: string;
  revision: number;
  editable: boolean;
  owner: boolean;
};
function rowFor(noteId: number, db: DatabaseConnection) {
  return db.sqlite
    .prepare(
      "select state, revision, updated_at updatedAt from note_workspaces where note_id=?",
    )
    .get(noteId) as WorkspaceRow | undefined;
}
export function decodeNoteUpdate(value: string): Uint8Array {
  if (value.length > 2_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value))
    throw new Error("Atualização inválida ou grande demais.");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > noteStateMaxBytes || !bytes.length)
    throw new Error("Atualização inválida ou grande demais.");
  return bytes;
}
function readDoc(state: Uint8Array) {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    return doc;
  } catch (error) {
    doc.destroy();
    throw error;
  }
}
function packet(
  row: WorkspaceRow,
  note: ReturnType<typeof getReadableNote>,
  userId: number,
): NoteWorkspaceState {
  const doc = readDoc(row.state);
  try {
    return {
      state: row.state.toString("base64"),
      vector: Buffer.from(Y.encodeStateVector(doc)).toString("base64"),
      revision: row.revision,
      editable: note.editable,
      owner: note.ownerUserId === userId,
    };
  } finally {
    doc.destroy();
  }
}

// This is the only Markdown → CRDT conversion. Once created, merge persisted Yjs
// updates; rebuilding the document from a snapshot would discard edit identities.
export async function initializeNoteWorkspace(
  userId: number,
  noteId: number,
  db: DatabaseConnection = getDatabase(),
): Promise<NoteWorkspaceState> {
  const note = getReadableNote(userId, noteId, db);
  let row = rowFor(noteId, db);
  if (!row) {
    const blocks = note.content
      ? await serverEditor().tryParseMarkdownToBlocks(note.content)
      : [{ type: "paragraph" as const }];
    const doc = serverEditor().blocksToYDoc(blocks, fragment);
    try {
      doc.getText("title").insert(0, note.title);
      db.sqlite
        .prepare(
          "insert into note_workspaces(note_id,state,revision,updated_at) values(?,?,0,?) on conflict(note_id) do nothing",
        )
        .run(noteId, Buffer.from(Y.encodeStateAsUpdate(doc)), Date.now());
    } finally {
      doc.destroy();
    }
    // A simultaneous first open must use the winner, never seed a second copy.
    row = rowFor(noteId, db)!;
  }
  return packet(row, getReadableNote(userId, noteId, db), userId);
}

function markdownFor(doc: Y.Doc): string {
  const blocks = serverEditor().yDocToBlocks(doc, fragment);
  let count = 0;
  function inline(value: unknown): string {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    if (Array.isArray(value)) return value.map(inline).join("");
    const v = value as {
      text?: string;
      type?: string;
      href?: string;
      content?: unknown;
      styles?: Record<string, unknown>;
    };
    let text = v.text ?? inline(v.content);
    if (v.type === "link") {
      const url = new URL(v.href ?? "");
      if (!["http:", "https:", "mailto:"].includes(url.protocol))
        throw new Error("Use um link HTTP, HTTPS ou de email.");
      return `[${text}](${url.toString()})`;
    }
    if (v.styles?.bold) text = `**${text}**`;
    if (v.styles?.italic) text = `_${text}_`;
    if (v.styles?.code) text = `\`${text}\``;
    return text;
  }
  function block(value: (typeof blocks)[number]): string {
    if (++count > 2500)
      throw new Error("Esta página atingiu o limite de blocos.");
    let text = "";
    if (value.type === "table") {
      const rows = value.content.rows.map(
        (r) =>
          `| ${r.cells.map((c) => inline(c).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`,
      );
      if (rows.length)
        rows.splice(
          1,
          0,
          `| ${value.content.rows[0].cells.map(() => "---").join(" | ")} |`,
        );
      text = rows.join("\n");
    } else {
      text = inline(value.content);
      if (value.type === "heading")
        text = `${"#".repeat(value.props.level)} ${text}`;
      if (value.type === "bulletListItem") text = `- ${text}`;
      if (value.type === "numberedListItem") text = `1. ${text}`;
      if (value.type === "checkListItem")
        text = `- [${value.props.checked ? "x" : " "}] ${text}`;
      if (value.type === "quote")
        text = text
          .split("\n")
          .map((t) => `> ${t}`)
          .join("\n");
      if (value.type === "codeBlock")
        text = `\`\`\`${value.props.language}\n${text}\n\`\`\``;
      if (value.type === "divider") text = "---";
    }
    return [text, ...(value.children ?? []).map(block)]
      .filter(Boolean)
      .join("\n\n");
  }
  const database = doc.getMap("database").toJSON();
  validateNoteDatabases(database);
  const text = [blocks.map(block).join("\n\n"), noteDatabasesMarkdown(database)]
    .filter(Boolean)
    .join("\n\n");
  if (text.length > 100_000)
    throw new Error("Use até 100 mil caracteres por página.");
  return text;
}

export function mergeNoteWorkspace(
  userId: number,
  noteId: number,
  update: Uint8Array,
  db: DatabaseConnection = getDatabase(),
): NoteWorkspaceState {
  if (update.length > noteStateMaxBytes)
    throw new Error("Atualização grande demais.");
  return db.sqlite.transaction(() => {
    const note = getReadableNote(userId, noteId, db);
    if (!note.editable)
      throw new Error("Você tem acesso somente para leitura.");
    const row = rowFor(noteId, db);
    if (!row) throw new Error("Reabra a página antes de salvar.");
    const doc = readDoc(row.state);
    try {
      Y.applyUpdate(doc, update);
      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      if (state.length > noteStateMaxBytes)
        throw new Error(
          "Esta página atingiu o limite de tamanho. Divida em subpáginas.",
        );
      if (state.equals(row.state)) return packet(row, note, userId);
      const title = doc.getText("title").toString().trim() || "Sem título";
      if (title.length > 180)
        throw new Error("Use até 180 caracteres no título.");
      const content = markdownFor(doc);
      const now = Date.now();
      const latest = db.sqlite
        .prepare(
          "select max(created_at) time from note_workspace_versions where note_id=?",
        )
        .get(noteId) as { time: number | null };
      if (!latest.time || now - latest.time > 30_000) {
        db.sqlite
          .prepare(
            "insert or ignore into note_workspace_versions(note_id,revision,state,actor_user_id,created_at) values(?,?,?,?,?)",
          )
          .run(noteId, row.revision, row.state, userId, now);
        db.sqlite
          .prepare(
            "delete from note_workspace_versions where note_id=? and revision not in (select revision from note_workspace_versions where note_id=? order by revision desc limit 15)",
          )
          .run(noteId, noteId);
      }
      db.sqlite
        .prepare(
          "update note_workspaces set state=?, revision=revision+1, updated_at=? where note_id=?",
        )
        .run(state, now, noteId);
      db.sqlite
        .prepare("update notes set title=?, content=?, updated_at=? where id=?")
        .run(title, content, now, noteId);
      return packet(
        { state, revision: row.revision + 1, updatedAt: now },
        note,
        userId,
      );
    } finally {
      doc.destroy();
    }
  })();
}

export function listNoteVersions(
  ownerId: number,
  noteId: number,
  db: DatabaseConnection = getDatabase(),
) {
  getUserNote(ownerId, noteId, db);
  return db.sqlite
    .prepare(
      `select v.revision, v.created_at createdAt, u.display_name author from note_workspace_versions v left join users u on u.id=v.actor_user_id where v.note_id=? order by v.revision desc limit 15`,
    )
    .all(noteId) as {
    revision: number;
    createdAt: number;
    author: string | null;
  }[];
}

export function copyNoteWorkspace(
  ownerId: number,
  noteId: number,
  revision?: number,
  db: DatabaseConnection = getDatabase(),
): NoteRecord {
  return db.sqlite.transaction(() => {
    const note = getUserNote(ownerId, noteId, db);
    const source =
      revision === undefined
        ? rowFor(noteId, db)
        : (db.sqlite
            .prepare(
              "select state from note_workspace_versions where note_id=? and revision=?",
            )
            .get(noteId, revision) as { state: Buffer } | undefined);
    if (revision !== undefined && !source)
      throw new Error("Versão não encontrada.");
    const copy = createNote(
      ownerId,
      {
        title: `${note.title.slice(0, 160)} — cópia`,
        content: note.content,
        offeringId: note.offeringId,
        activityId: note.activityId,
        parentNoteId: note.parentNoteId,
      },
      db,
    );
    if (source) {
      const doc = readDoc(source.state);
      try {
        const title = doc.getText("title");
        title.delete(0, title.length);
        title.insert(0, copy.title);
        const state = Buffer.from(Y.encodeStateAsUpdate(doc));
        db.sqlite
          .prepare(
            "insert into note_workspaces(note_id,state,revision,updated_at) values(?,?,0,?)",
          )
          .run(copy.id, state, Date.now());
        db.sqlite
          .prepare("update notes set content=? where id=?")
          .run(markdownFor(doc), copy.id);
      } finally {
        doc.destroy();
      }
    }
    return getUserNote(ownerId, copy.id, db);
  })();
}

export function importNoteWorkspace(
  ownerId: number,
  filename: string,
  content: string,
  db: DatabaseConnection = getDatabase(),
): NoteRecord {
  return db.sqlite.transaction(() => {
    const title =
      filename.replace(/\.(md|markdown|txt|json)$/i, "").slice(0, 160) ||
      "Página importada";
    if (/\.json$/i.test(filename)) {
      const value = JSON.parse(content) as { format?: string; state?: string };
      if (
        value.format !== "openstudyhub-note" ||
        typeof value.state !== "string"
      )
        throw new Error("Escolha um rascunho de recuperação do OpenStudyHub.");
      const doc = readDoc(decodeNoteUpdate(value.state));
      try {
        const importedTitle = doc.getText("title").toString().trim() || title;
        const markdown = markdownFor(doc);
        const note = createNote(
          ownerId,
          { title: importedTitle, content: markdown },
          db,
        );
        db.sqlite
          .prepare(
            "insert into note_workspaces(note_id,state,revision,updated_at) values(?,?,0,?)",
          )
          .run(note.id, Buffer.from(Y.encodeStateAsUpdate(doc)), Date.now());
        return note;
      } finally {
        doc.destroy();
      }
    }
    if (
      !/\.(md|markdown|txt)$/i.test(filename) ||
      Buffer.byteLength(content) > 100_000
    )
      throw new Error("Escolha Markdown ou texto de até 100 KB.");
    return createNote(ownerId, { title, content }, db);
  })();
}
