import type { DatabaseConnection } from "@/lib/db/client";
import { getReadableNote, listUserNotes, listSharedNotes } from "@/lib/notes";
import {
  getUserProject,
  listProjectFiles,
  listUserProjects,
  readProjectSource,
  groupSharedProjectIds,
} from "@/lib/projects";
import {
  listUserGeneratedDocuments,
  listSharedGeneratedDocuments,
  downloadGeneratedDocument,
} from "@/lib/document-workflows";
import {
  listLocalDocuments,
  listSharedLocalDocuments,
  getLocalDocument,
} from "@/lib/v2/local-documents";
import { canonicalIdForLegacy } from "@/lib/v2/identity-bridge";
import { withV2Db } from "@/lib/v2/runtime-database";
import { extractIsolated } from "./extract-isolated";
export type SourceReference = {
  kind: "note" | "document" | "local-document" | "project" | "material";
  id: number;
  path?: string;
};
export type SourceChoice = SourceReference & { title: string };
const unavailable = () =>
  new Error(
    "Fonte indisponível ou sem permissão para este grupo. Compartilhe a fonte com o grupo antes de continuar. / Source unavailable or not shared with this group. Share the source with the group first.",
  );
export function validateReference(input: unknown): SourceReference {
  const value = input as SourceReference;
  if (
    !value ||
    !["note", "document", "local-document", "project", "material"].includes(
      value.kind,
    ) ||
    !Number.isSafeInteger(value.id) ||
    value.id < 1 ||
    (value.path !== undefined &&
      (typeof value.path !== "string" || value.path.length > 512))
  )
    throw unavailable();
  return {
    kind: value.kind,
    id: value.id,
    ...(value.path ? { path: value.path } : {}),
  };
}
export function assertSourceAccess(
  userId: number,
  ref: SourceReference,
  groupId: number | null,
  connection: DatabaseConnection,
) {
  validateReference(ref);
  const db = connection.sqlite;
  if (ref.kind === "note") {
    if (!getReadableNote(userId, ref.id, connection)) throw unavailable();
    if (
      groupId &&
      !db
        .prepare(
          "SELECT 1 FROM note_group_shares WHERE note_id=? AND group_id=?",
        )
        .get(ref.id, groupId)
    )
      throw unavailable();
  } else if (ref.kind === "project") {
    getUserProject(userId, ref.id, connection);
    if (
      !ref.path ||
      !listProjectFiles(userId, ref.id, connection).some(
        (f) => f.path === ref.path,
      )
    )
      throw unavailable();
    if (
      groupId &&
      !db
        .prepare(
          "SELECT 1 FROM project_group_shares WHERE project_id=? AND group_id=?",
        )
        .get(ref.id, groupId)
    )
      throw unavailable();
  } else if (ref.kind === "document") {
    if (
      ![
        ...listUserGeneratedDocuments(userId, connection),
        ...listSharedGeneratedDocuments(userId, connection),
      ].some((d) => d.id === ref.id)
    )
      throw unavailable();
    if (
      groupId &&
      !db
        .prepare(
          "SELECT 1 FROM document_group_shares WHERE document_id=? AND group_id=?",
        )
        .get(ref.id, groupId)
    )
      throw unavailable();
  } else if (ref.kind === "local-document") {
    const permitted = withV2Db((canonical) => {
      const canonicalId = canonicalIdForLegacy(canonical, userId);
      if (!canonicalId) return false;
      const groups = db
        .prepare(
          "SELECT m.group_id id FROM study_group_members m JOIN study_groups g ON g.id=m.group_id WHERE m.user_id=? AND g.archived_at IS NULL",
        )
        .all(userId) as { id: number }[];
      return !!canonical
        .prepare(
          `SELECT 1 FROM local_documents d WHERE d.id=? AND (d.user_id=? OR EXISTS (SELECT 1 FROM local_document_person_shares p WHERE p.document_id=d.id AND p.recipient_user_id=?) OR EXISTS (SELECT 1 FROM local_document_group_shares g WHERE g.document_id=d.id AND g.group_legacy_id IN (SELECT value FROM json_each(?))))`,
        )
        .get(
          ref.id,
          canonicalId,
          canonicalId,
          JSON.stringify(groups.map((g) => g.id)),
        );
    });
    if (!permitted) throw unavailable();
    if (
      groupId &&
      !withV2Db((db) =>
        db
          .prepare(
            "SELECT 1 FROM local_document_group_shares WHERE document_id=? AND group_legacy_id=?",
          )
          .get(ref.id, groupId),
      )
    )
      throw unavailable();
  } else {
    // Classroom cache belongs to the connected person. It has no group-sharing ACL.
    if (
      groupId ||
      !db
        .prepare(
          "SELECT 1 FROM classroom_feed_items WHERE id=? AND user_id=? AND type='material'",
        )
        .get(ref.id, userId)
    )
      throw unavailable();
  }
}
export async function resolveSource(
  userId: number,
  reference: unknown,
  groupId: number | null,
  connection: DatabaseConnection,
) {
  const ref = validateReference(reference);
  assertSourceAccess(userId, ref, groupId, connection);
  let title = "",
    text = "",
    truncated = false;
  if (ref.kind === "note") {
    const note = getReadableNote(userId, ref.id, connection)!;
    title = note.title;
    text = note.content;
  } else if (ref.kind === "material") {
    const item = connection.sqlite
      .prepare(
        "SELECT title,excerpt FROM classroom_feed_items WHERE id=? AND user_id=?",
      )
      .get(ref.id, userId) as { title: string; excerpt: string };
    title = item.title;
    text = item.excerpt ?? "";
  } else {
    let bytes: Buffer;
    if (ref.kind === "project") {
      title = ref.path!.split("/").at(-1)!;
      bytes = await readProjectSource(userId, ref.id, ref.path!, {
        connection,
        maxBytes: 10 * 1024 * 1024,
      });
    } else if (ref.kind === "local-document") {
      const doc = getLocalDocument(userId, ref.id)!;
      title = doc.name;
      bytes = doc.content;
    } else {
      const doc = await downloadGeneratedDocument(userId, ref.id, {
        connection,
      });
      title = `${doc.name.replace(/\.pdf$/i, "")}.pdf`;
      bytes = doc.bytes;
    }
    const extracted = await extractIsolated(
      ref.kind === "project" && !/\.(pdf|docx)$/i.test(title)
        ? `${title}.txt`
        : title,
      bytes,
      false,
    );
    text = extracted.text;
    truncated = extracted.truncated;
  }
  // Recheck after asynchronous reads (membership/permissions may have changed).
  assertSourceAccess(userId, ref, groupId, connection);
  return {
    ref,
    title,
    text: text.slice(0, 50_000),
    truncated: truncated || text.length > 50_000,
  };
}
export function listSourceChoices(
  userId: number,
  connection: DatabaseConnection,
) {
  const choices: SourceChoice[] = [
    ...listUserNotes(userId, "", connection),
    ...listSharedNotes(userId, connection),
  ]
    .slice(0, 100)
    .map((n) => ({ kind: "note", id: n.id, title: n.title }));
  for (const d of [
    ...listUserGeneratedDocuments(userId, connection),
    ...listSharedGeneratedDocuments(userId, connection),
  ].slice(0, 100))
    choices.push({ kind: "document", id: d.id, title: d.name });
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1")
    for (const d of [
      ...listLocalDocuments(userId),
      ...listSharedLocalDocuments(userId),
    ].slice(0, 100))
      choices.push({ kind: "local-document", id: d.id, title: d.name });
  const projects = new Set([
    ...listUserProjects(userId, undefined, connection).map((p) => p.id),
    ...groupSharedProjectIds(userId, connection),
  ]);
  for (const id of [...projects].slice(0, 50))
    for (const file of listProjectFiles(userId, id, connection).slice(0, 30))
      if (
        /\.(?:pdf|docx|txt|md|markdown|js|jsx|ts|tsx|py|java|c|cpp|cs|go|rs|rb|sh|sql|html|css|json|yaml|yml|toml)$/i.test(
          file.path,
        )
      )
        choices.push({
          kind: "project",
          id,
          path: file.path,
          title: `${getUserProject(userId, id, connection).name} / ${file.path}`,
        });
  const materials = connection.sqlite
    .prepare(
      "SELECT id,title FROM classroom_feed_items WHERE user_id=? AND type='material' ORDER BY published_at DESC LIMIT 100",
    )
    .all(userId) as { id: number; title: string }[];
  choices.push(...materials.map((m) => ({ kind: "material" as const, ...m })));
  return choices.slice(0, 500);
}
