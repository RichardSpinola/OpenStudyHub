import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { isUserEnrolled } from "@/lib/enrollments";

const idSchema = z.number().int().positive();
const optionalIdSchema = idSchema.optional().nullable();
const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().max(100_000).default(""),
  offeringId: optionalIdSchema,
  activityId: optionalIdSchema,
});

export type NoteInput = z.input<typeof noteInputSchema>;
export type NoteRecord = {
  id: number;
  ownerUserId: number;
  offeringId: number | null;
  activityId: number | null;
  title: string;
  content: string;
  subjectName: string | null;
  activityTitle: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ReadableNoteRecord = NoteRecord & { editable: boolean };

export type SharedNoteRecord = NoteRecord & {
  ownerName: string;
};

const noteSelect = `
  select n.id, n.owner_user_id as ownerUserId,
         n.offering_id as offeringId, n.activity_id as activityId,
         n.title, n.content, s.name as subjectName,
         a.title as activityTitle, n.created_at as createdAt,
         n.updated_at as updatedAt
  from notes n
  left join subject_offerings so on so.id = n.offering_id
  left join subjects s on s.id = so.subject_id
  left join activities a on a.id = n.activity_id
`;

function resolveAssociations(
  ownerUserId: number,
  offeringIdInput: number | null | undefined,
  activityIdInput: number | null | undefined,
  connection: DatabaseConnection,
): { offeringId: number | null; activityId: number | null } {
  const ownerId = idSchema.parse(ownerUserId);
  let offeringId = optionalIdSchema.parse(offeringIdInput) ?? null;
  const activityId = optionalIdSchema.parse(activityIdInput) ?? null;

  if (activityId !== null) {
    const activity = connection.sqlite
      .prepare(
        `select offering_id as offeringId from activities
         where id = ? and user_id = ?`,
      )
      .get(activityId, ownerId) as { offeringId: number } | undefined;
    if (!activity) throw new Error("Activity not found.");
    if (offeringId !== null && offeringId !== activity.offeringId) {
      throw new Error("Activity and offering do not match.");
    }
    offeringId = activity.offeringId;
  }

  if (offeringId !== null && !isUserEnrolled(ownerId, offeringId, connection)) {
    throw new Error("Offering is outside the user's academic context.");
  }

  return { offeringId, activityId };
}

export function listUserNotes(
  ownerUserId: number,
  queryInput = "",
  connection: DatabaseConnection = getDatabase(),
): NoteRecord[] {
  const ownerId = idSchema.parse(ownerUserId);
  const query = z.string().trim().max(200).parse(queryInput);
  if (!query) {
    return connection.sqlite
      .prepare(
        `${noteSelect}
         where n.owner_user_id = ?
         order by n.updated_at desc, n.id desc`,
      )
      .all(ownerId) as NoteRecord[];
  }

  const escaped = query
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const pattern = `%${escaped.toLocaleLowerCase("pt-BR")}%`;
  return connection.sqlite
    .prepare(
      `${noteSelect}
       where n.owner_user_id = ?
         and (lower(n.title) like ? escape '\\'
              or lower(n.content) like ? escape '\\')
       order by n.updated_at desc, n.id desc`,
    )
    .all(ownerId, pattern, pattern) as NoteRecord[];
}

export function listSharedNotes(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): SharedNoteRecord[] {
  const actorId = idSchema.parse(userId);
  return connection.sqlite
    .prepare(
      `select distinct n.id, n.owner_user_id as ownerUserId,
              n.offering_id as offeringId, n.activity_id as activityId,
              n.title, n.content, s.name as subjectName,
              a.title as activityTitle, owner.display_name as ownerName,
              n.created_at as createdAt, n.updated_at as updatedAt
       from notes n
       join users owner on owner.id = n.owner_user_id
       left join subject_offerings so on so.id = n.offering_id
       left join subjects s on s.id = so.subject_id
       left join activities a on a.id = n.activity_id
       join note_group_shares ngs on ngs.note_id = n.id
       join study_group_members gm on gm.group_id = ngs.group_id
       where gm.user_id = ? and n.owner_user_id != ? and n.offering_id is not null
       order by n.updated_at desc, n.id desc`,
    )
    .all(actorId, actorId) as SharedNoteRecord[];
}

export function getUserNote(
  ownerUserId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): NoteRecord {
  const row = connection.sqlite
    .prepare(`${noteSelect} where n.owner_user_id = ? and n.id = ?`)
    .get(idSchema.parse(ownerUserId), idSchema.parse(noteId)) as
    NoteRecord | undefined;
  if (!row) throw new Error("Note not found.");
  return row;
}

export function getReadableNote(
  userId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): ReadableNoteRecord {
  const actorId = idSchema.parse(userId);
  const row = connection.sqlite
    .prepare(
      `select n.id, n.owner_user_id as ownerUserId,
         n.offering_id as offeringId, n.activity_id as activityId,
         n.title, n.content, s.name as subjectName,
         a.title as activityTitle, n.created_at as createdAt,
         n.updated_at as updatedAt,
         case when n.owner_user_id = ? then 1 else 0 end as editable
       from notes n
       left join subject_offerings so on so.id = n.offering_id
       left join subjects s on s.id = so.subject_id
       left join activities a on a.id = n.activity_id
       where n.id = ? and (
         n.owner_user_id = ? or (n.offering_id is not null and exists (
           select 1 from note_group_shares ngs
           join study_group_members gm on gm.group_id = ngs.group_id
           where ngs.note_id = n.id and gm.user_id = ?
         ))
       )`,
    )
    .get(actorId, idSchema.parse(noteId), actorId, actorId) as
    (NoteRecord & { editable: number }) | undefined;
  if (!row) throw new Error("Note not found.");
  return { ...row, editable: Boolean(row.editable) };
}

export function createNote(
  ownerUserId: number,
  input: NoteInput,
  connection: DatabaseConnection = getDatabase(),
): NoteRecord {
  const ownerId = idSchema.parse(ownerUserId);
  const value = noteInputSchema.parse(input);
  const associations = resolveAssociations(
    ownerId,
    value.offeringId,
    value.activityId,
    connection,
  );
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into notes
       (owner_user_id, offering_id, activity_id, title, content, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      ownerId,
      associations.offeringId,
      associations.activityId,
      value.title,
      value.content,
      now,
      now,
    );
  return getUserNote(ownerId, Number(result.lastInsertRowid), connection);
}

export function updateNote(
  ownerUserId: number,
  noteId: number,
  input: NoteInput,
  connection: DatabaseConnection = getDatabase(),
): NoteRecord {
  const ownerId = idSchema.parse(ownerUserId);
  const id = idSchema.parse(noteId);
  const value = noteInputSchema.parse(input);
  const associations = resolveAssociations(
    ownerId,
    value.offeringId,
    value.activityId,
    connection,
  );
  const result = connection.sqlite
    .prepare(
      `update notes
       set offering_id = ?, activity_id = ?, title = ?, content = ?, updated_at = ?
       where id = ? and owner_user_id = ?`,
    )
    .run(
      associations.offeringId,
      associations.activityId,
      value.title,
      value.content,
      Date.now(),
      id,
      ownerId,
    );
  if (result.changes !== 1) throw new Error("Note not found.");
  return getUserNote(ownerId, id, connection);
}

export function deleteNote(
  ownerUserId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const result = connection.sqlite
    .prepare("delete from notes where id = ? and owner_user_id = ?")
    .run(idSchema.parse(noteId), idSchema.parse(ownerUserId));
  if (result.changes !== 1) throw new Error("Note not found.");
}
