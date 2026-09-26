import { z } from "zod";
import { isUserEnrolled } from "@/lib/enrollments";
import { listUserSubjectOfferings } from "@/lib/academic";
import { canonicalChatUserId } from "./chat-state";
import { withV2Db } from "./runtime";
import { listUserStudyGroups, listVisibleUsers } from "@/lib/collaboration";

const maxBytes = 10 * 1024 * 1024;
export type LocalDocument = {
  id: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
  offeringId: number | null;
  subjectName: string | null;
  updatedAt: number;
  shared?: boolean;
};

function memberGroupIds(legacyUserId: number): number[] {
  try {
    return listUserStudyGroups(legacyUserId).map((group) => group.id);
  } catch {
    return [];
  } // Fail closed when the legacy group directory is unavailable.
}

export function setLocalDocumentShare(
  legacyOwnerId: number,
  documentId: number,
  kind: "person" | "group",
  recipientId: number,
  enabled: boolean,
): void {
  if (
    !Number.isSafeInteger(documentId) ||
    documentId < 1 ||
    !Number.isSafeInteger(recipientId) ||
    recipientId < 1
  )
    throw new Error("Destino inválido.");
  if (
    kind === "person" &&
    enabled &&
    !listVisibleUsers(legacyOwnerId).some((person) => person.id === recipientId)
  )
    throw new Error("Pessoa indisponível.");
  if (
    kind === "group" &&
    enabled &&
    !memberGroupIds(legacyOwnerId).includes(recipientId)
  )
    throw new Error("Grupo indisponível.");
  withV2Db((db) => {
    const ownerId = canonicalChatUserId(db, legacyOwnerId);
    if (
      !db
        .prepare("SELECT 1 FROM local_documents WHERE id=? AND user_id=?")
        .get(documentId, ownerId)
    )
      throw new Error("Documento indisponível.");
    const table =
      kind === "person"
        ? "local_document_person_shares"
        : "local_document_group_shares";
    const column = kind === "person" ? "recipient_user_id" : "group_legacy_id";
    const target =
      kind === "person" ? canonicalChatUserId(db, recipientId) : recipientId;
    if (enabled)
      db.prepare(
        `INSERT OR IGNORE INTO ${table}(document_id,${column}) VALUES(?,?)`,
      ).run(documentId, target);
    else
      db.prepare(
        `DELETE FROM ${table} WHERE document_id=? AND ${column}=?`,
      ).run(documentId, target);
  });
}

export function listLocalDocumentShares(
  legacyOwnerId: number,
  documentId: number,
): { people: number[]; groups: number[] } {
  return withV2Db((db) => {
    const ownerId = canonicalChatUserId(db, legacyOwnerId);
    if (
      !db
        .prepare("SELECT 1 FROM local_documents WHERE id=? AND user_id=?")
        .get(documentId, ownerId)
    )
      return { people: [], groups: [] };
    const people = db
      .prepare(
        `SELECT l.legacy_user_id id FROM local_document_person_shares s
      JOIN legacy_user_links l ON l.user_id=s.recipient_user_id WHERE s.document_id=?`,
      )
      .all(documentId) as Array<{ id: number }>;
    const groups = db
      .prepare(
        "SELECT group_legacy_id id FROM local_document_group_shares WHERE document_id=?",
      )
      .all(documentId) as Array<{ id: number }>;
    return {
      people: people.map(({ id }) => id),
      groups: groups.map(({ id }) => id),
    };
  });
}

export function listSharedLocalDocuments(
  legacyUserId: number,
): LocalDocument[] {
  const groups = memberGroupIds(legacyUserId);
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const groupWhere = groups.length
      ? `OR EXISTS (SELECT 1 FROM local_document_group_shares g WHERE g.document_id=d.id AND g.group_legacy_id IN (${groups.map(() => "?").join(",")}))`
      : "";
    return (
      db
        .prepare(
          `SELECT d.id,d.name,d.mime_type mimeType,d.size_bytes sizeBytes,d.offering_legacy_id offeringId,d.updated_at updatedAt
      FROM local_documents d WHERE d.user_id!=? AND (EXISTS (SELECT 1 FROM local_document_person_shares p WHERE p.document_id=d.id AND p.recipient_user_id=?) ${groupWhere}) ORDER BY d.updated_at DESC LIMIT 200`,
        )
        .all(userId, userId, ...groups) as Omit<LocalDocument, "subjectName">[]
    ).map((row) => ({ ...row, subjectName: null, shared: true }));
  });
}

function verifiedMime(name: string, data: Buffer): string {
  const ext = name.toLowerCase().split(".").at(-1);
  if (ext === "pdf" && data.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  if (
    ext === "docx" &&
    data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
    data.includes(Buffer.from("[Content_Types].xml")) &&
    data.includes(Buffer.from("word/document.xml"))
  )
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (
    ext === "txt" &&
    !data.includes(0) &&
    !new TextDecoder("utf-8", { fatal: true }).decode(data).includes("\ufffd")
  )
    return "text/plain";
  throw new Error("Use PDF, DOCX ou TXT válido.");
}

export function createLocalDocument(
  legacyUserId: number,
  nameInput: string,
  data: Buffer,
  offeringIdInput?: number | null,
): number {
  const name = z.string().trim().min(1).max(180).parse(nameInput);
  if (!data.length || data.length > maxBytes)
    throw new Error("O arquivo deve ter até 10 MiB.");
  const mime = verifiedMime(name, data);
  const offeringId = offeringIdInput ?? null;
  if (offeringId !== null && !isUserEnrolled(legacyUserId, offeringId))
    throw new Error("Disciplina indisponível.");
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    return Number(
      db
        .prepare(
          "INSERT INTO local_documents(user_id,offering_legacy_id,name,mime_type,content,size_bytes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          userId,
          offeringId,
          name,
          mime,
          data,
          data.length,
          Date.now(),
          Date.now(),
        ).lastInsertRowid,
    );
  });
}

export function listLocalDocuments(legacyUserId: number): LocalDocument[] {
  const rows = withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    return db
      .prepare(
        "SELECT id,name,mime_type mimeType,size_bytes sizeBytes,offering_legacy_id offeringId,updated_at updatedAt FROM local_documents WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 200",
      )
      .all(userId) as Omit<LocalDocument, "subjectName">[];
  });
  const names = new Map(
    listUserSubjectOfferings(legacyUserId).map((offering) => [
      offering.offeringId,
      offering.subjectName,
    ]),
  );
  return rows.map((row) => ({
    ...row,
    subjectName: row.offeringId ? (names.get(row.offeringId) ?? null) : null,
  }));
}

export function getLocalDocument(
  legacyUserId: number,
  documentId: number,
): { name: string; mimeType: string; content: Buffer } | null {
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const groups = memberGroupIds(legacyUserId);
    const groupWhere = groups.length
      ? `OR EXISTS (SELECT 1 FROM local_document_group_shares g WHERE g.document_id=d.id AND g.group_legacy_id IN (${groups.map(() => "?").join(",")}))`
      : "";
    return (
      (db
        .prepare(
          `SELECT d.name,d.mime_type mimeType,d.content FROM local_documents d WHERE d.id=? AND (d.user_id=? OR EXISTS (SELECT 1 FROM local_document_person_shares p WHERE p.document_id=d.id AND p.recipient_user_id=?) ${groupWhere})`,
        )
        .get(documentId, userId, userId, ...groups) as
        { name: string; mimeType: string; content: Buffer } | undefined) ?? null
    );
  });
}

export function deleteLocalDocument(
  legacyUserId: number,
  documentId: number,
): void {
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const result = db
      .prepare("DELETE FROM local_documents WHERE id=? AND user_id=?")
      .run(documentId, userId);
    if (!result.changes) throw new Error("Documento indisponível.");
  });
}
