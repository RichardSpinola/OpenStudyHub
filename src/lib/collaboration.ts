import { z } from "zod";

import { getAcademicAuthority } from "@/lib/academic-authority";
import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { createNotification } from "@/lib/notifications";

const idSchema = z.number().int().positive();
const idsSchema = z.array(idSchema).max(100);

export type VisibleUser = {
  id: number;
  displayName: string;
  programName: string | null;
  cohortName: string | null;
};
export type StudyGroup = {
  id: number;
  name: string;
  description: string | null;
  subjectOfferingId: number | null;
  subjectName: string | null;
  createdByUserId: number;
  memberRole: "owner" | "member";
  memberCount: number;
};

function activeUser(userId: number, connection: DatabaseConnection): void {
  if (
    !connection.sqlite
      .prepare("select 1 from users where id = ? and active = 1")
      .get(idSchema.parse(userId))
  ) {
    throw new Error("Forbidden.");
  }
}

export function listVisibleUsers(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): VisibleUser[] {
  const actorId = idSchema.parse(userId);
  activeUser(actorId, connection);
  return connection.sqlite
    .prepare(
      `select distinct u.id, u.display_name as displayName,
              p.name as programName, c.name as cohortName
       from users u
       left join user_academic_memberships target_m on target_m.user_id = u.id
       left join programs p on p.id = target_m.program_id
       left join cohorts c on c.id = target_m.cohort_id
       where u.active = 1 and u.role = 'member' and u.id != ?
       order by u.display_name collate nocase, u.id
       limit 200`,
    )
    .all(actorId) as VisibleUser[];
}

export function canViewUser(
  actorUserId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const actorId = idSchema.parse(actorUserId);
  const targetId = idSchema.parse(targetUserId);
  if (actorId === targetId) return true;
  const publicUser = connection.sqlite
    .prepare("select 1 from users where id=? and active=1 and role='member'")
    .get(targetId);
  if (publicUser) return true;
  const authority = getAcademicAuthority(actorId, connection);
  if (authority.role === "admin") return true;
  const membership = connection.sqlite
    .prepare(
      "select program_id as programId, cohort_id as cohortId from user_academic_memberships where user_id = ?",
    )
    .get(targetId) as
    { programId: number; cohortId: number | null } | undefined;
  if (
    membership &&
    ((authority.role === "moderator" &&
      authority.programIds.includes(membership.programId)) ||
      (authority.role === "curator" &&
        membership.cohortId !== null &&
        authority.cohortIds.includes(membership.cohortId)))
  )
    return true;
  return listVisibleUsers(actorId, connection).some(
    ({ id }) => id === targetId,
  );
}

function isEnrolled(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection,
): boolean {
  return Boolean(
    connection.sqlite
      .prepare(
        "select 1 from enrollments where user_id = ? and offering_id = ?",
      )
      .get(userId, offeringId),
  );
}

export function createStudyGroup(
  ownerUserId: number,
  input: {
    name: string;
    description?: string | null;
    subjectOfferingId?: number | null;
    memberUserIds?: number[];
  },
  connection: DatabaseConnection = getDatabase(),
): StudyGroup {
  const ownerId = idSchema.parse(ownerUserId);
  const value = z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(500).optional().nullable(),
      subjectOfferingId: idSchema.optional().nullable(),
      memberUserIds: idsSchema.optional().default([]),
    })
    .parse(input);
  const memberIds = [...new Set([ownerId, ...value.memberUserIds])];
  const visible = new Set(
    listVisibleUsers(ownerId, connection).map(({ id }) => id),
  );
  if (memberIds.some((id) => id !== ownerId && !visible.has(id))) {
    throw new Error("Group member is outside the visible academic context.");
  }
  if (
    value.subjectOfferingId &&
    memberIds.some(
      (id) => !isEnrolled(id, value.subjectOfferingId!, connection),
    )
  ) {
    throw new Error("Group member is outside the Subject Offering.");
  }
  let groupId = 0;
  connection.sqlite.transaction(() => {
    const now = Date.now();
    groupId = Number(
      connection.sqlite
        .prepare(
          `insert into study_groups
           (name, description, subject_offering_id, created_by_user_id,
            created_at, updated_at) values (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          value.name,
          value.description || null,
          value.subjectOfferingId ?? null,
          ownerId,
          now,
          now,
        ).lastInsertRowid,
    );
    const add = connection.sqlite.prepare(
      `insert into study_group_members (group_id, user_id, member_role, joined_at)
       values (?, ?, ?, ?)`,
    );
    for (const memberId of memberIds) {
      add.run(
        groupId,
        memberId,
        memberId === ownerId ? "owner" : "member",
        now,
      );
    }
    connection.sqlite
      .prepare(
        `insert into chat_rooms (kind, name, group_id, created_by_user_id, created_at)
         values ('group', ?, ?, ?, ?)`,
      )
      .run(value.name, groupId, ownerId, now);
    recordAuditEvent(
      {
        actorUserId: ownerId,
        action: "group.create",
        targetType: "study_group",
        targetId: String(groupId),
        summary: "study group created",
      },
      connection,
    );
  })();
  for (const memberId of memberIds.filter((id) => id !== ownerId)) {
    createNotification(
      memberId,
      {
        type: "group_membership",
        actorUserId: ownerId,
        entityType: "study_group",
        entityId: groupId,
        title: `Você entrou no grupo ${value.name}`,
      },
      connection,
    );
  }
  return getStudyGroup(ownerId, groupId, connection);
}

export function listUserStudyGroups(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): StudyGroup[] {
  return connection.sqlite
    .prepare(
      `select g.id, g.name, g.description,
              g.subject_offering_id as subjectOfferingId,
              s.name as subjectName, g.created_by_user_id as createdByUserId,
              mine.member_role as memberRole,
              (select count(*) from study_group_members gm where gm.group_id = g.id) as memberCount
       from study_groups g
       join study_group_members mine on mine.group_id = g.id and mine.user_id = ?
       left join subject_offerings so on so.id = g.subject_offering_id
       left join subjects s on s.id = so.subject_id
       where g.archived_at is null
       order by g.updated_at desc, g.id desc`,
    )
    .all(idSchema.parse(userId)) as StudyGroup[];
}

export function getStudyGroup(
  userId: number,
  groupId: number,
  connection: DatabaseConnection = getDatabase(),
): StudyGroup {
  const group = listUserStudyGroups(userId, connection).find(
    ({ id }) => id === idSchema.parse(groupId),
  );
  if (!group) throw new Error("Group not found.");
  return group;
}

function getStudyGroupForManagement(
  groupId: number,
  connection: DatabaseConnection,
): StudyGroup {
  const group = connection.sqlite
    .prepare(
      `select g.id, g.name, g.description,
              g.subject_offering_id as subjectOfferingId,
              s.name as subjectName, g.created_by_user_id as createdByUserId,
              'member' as memberRole,
              (select count(*) from study_group_members gm where gm.group_id = g.id) as memberCount
       from study_groups g
       left join subject_offerings so on so.id = g.subject_offering_id
       left join subjects s on s.id = so.subject_id
       where g.id = ? and g.archived_at is null`,
    )
    .get(idSchema.parse(groupId)) as StudyGroup | undefined;
  if (!group) throw new Error("Group not found.");
  return group;
}

function listGroupMemberIds(
  groupId: number,
  connection: DatabaseConnection,
): number[] {
  return (
    connection.sqlite
      .prepare(
        "select user_id as id from study_group_members where group_id = ?",
      )
      .all(idSchema.parse(groupId)) as Array<{ id: number }>
  ).map(({ id }) => id);
}

export function listGroupMembers(
  userId: number,
  groupId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{ id: number; displayName: string; role: "owner" | "member" }> {
  getStudyGroup(userId, groupId, connection);
  return connection.sqlite
    .prepare(
      `select u.id, u.display_name as displayName, gm.member_role as role
       from study_group_members gm join users u on u.id = gm.user_id
       where gm.group_id = ? and u.active = 1
       order by gm.member_role desc, u.display_name collate nocase`,
    )
    .all(groupId) as Array<{
    id: number;
    displayName: string;
    role: "owner" | "member";
  }>;
}

function assertCanManageGroup(
  actorUserId: number,
  groupId: number,
  targetUserId: number | null,
  connection: DatabaseConnection,
): void {
  const actorId = idSchema.parse(actorUserId);
  const targetId = targetUserId === null ? null : idSchema.parse(targetUserId);
  const owner = connection.sqlite
    .prepare(
      "select 1 from study_group_members where group_id = ? and user_id = ? and member_role = 'owner'",
    )
    .get(groupId, actorId);
  if (owner) return;
  const authority = getAcademicAuthority(actorId, connection);
  if (authority.role === "admin") return;
  const users =
    targetId === null ? listGroupMemberIds(groupId, connection) : [targetId];
  const memberships = users.map(
    (id) =>
      connection.sqlite
        .prepare(
          `select program_id as programId, cohort_id as cohortId
         from user_academic_memberships where user_id = ?`,
        )
        .get(id) as { programId: number; cohortId: number | null } | undefined,
  );
  if (
    authority.role === "moderator" &&
    memberships.every((membership) =>
      membership ? authority.programIds.includes(membership.programId) : false,
    )
  )
    return;
  if (
    authority.role === "curator" &&
    memberships.every((membership) =>
      membership?.cohortId
        ? authority.cohortIds.includes(membership.cohortId)
        : false,
    )
  )
    return;
  throw new Error("Forbidden.");
}

export function addStudyGroupMember(
  actorUserId: number,
  groupId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const group = getStudyGroupForManagement(groupId, connection);
  const targetId = idSchema.parse(targetUserId);
  assertCanManageGroup(actorUserId, group.id, targetId, connection);
  if (!canViewUser(actorUserId, targetId, connection))
    throw new Error("Forbidden.");
  if (
    group.subjectOfferingId &&
    !isEnrolled(targetId, group.subjectOfferingId, connection)
  )
    throw new Error("Group member is outside the Subject Offering.");
  connection.sqlite
    .prepare(
      `insert into study_group_members (group_id, user_id, member_role)
       values (?, ?, 'member') on conflict(group_id, user_id) do nothing`,
    )
    .run(group.id, targetId);
}

export function removeStudyGroupMember(
  actorUserId: number,
  groupId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const group = getStudyGroupForManagement(groupId, connection);
  const targetId = idSchema.parse(targetUserId);
  assertCanManageGroup(actorUserId, group.id, targetId, connection);
  const target = connection.sqlite
    .prepare(
      "select member_role as role from study_group_members where group_id = ? and user_id = ?",
    )
    .get(group.id, targetId) as { role: string } | undefined;
  if (target?.role === "owner")
    throw new Error("Group owner cannot be removed.");
  connection.sqlite
    .prepare(
      "delete from study_group_members where group_id = ? and user_id = ?",
    )
    .run(group.id, targetId);
}

export function leaveStudyGroup(
  actorUserId: number,
  groupId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const membership = connection.sqlite
    .prepare(
      "SELECT member_role role FROM study_group_members WHERE group_id=? AND user_id=?",
    )
    .get(idSchema.parse(groupId), idSchema.parse(actorUserId)) as
    { role: string } | undefined;
  if (!membership) throw new Error("Você não participa do grupo.");
  if (membership.role === "owner")
    throw new Error(
      "O responsável deve encerrar o grupo ou transferir a responsabilidade.",
    );
  connection.sqlite
    .prepare("DELETE FROM study_group_members WHERE group_id=? AND user_id=?")
    .run(groupId, actorUserId);
}

export function closeStudyGroup(
  actorUserId: number,
  groupId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const group = connection.sqlite
    .prepare(
      "SELECT created_by_user_id ownerId,archived_at archivedAt FROM study_groups WHERE id=?",
    )
    .get(idSchema.parse(groupId)) as
    { ownerId: number; archivedAt: number | null } | undefined;
  if (
    !group ||
    group.ownerId !== idSchema.parse(actorUserId) ||
    group.archivedAt
  )
    throw new Error("Somente o responsável pode encerrar o grupo.");
  connection.sqlite.transaction(() => {
    const now = Date.now();
    connection.sqlite
      .prepare("UPDATE study_groups SET archived_at=?,updated_at=? WHERE id=?")
      .run(now, now, groupId);
    connection.sqlite
      .prepare("UPDATE chat_rooms SET archived_at=? WHERE group_id=?")
      .run(now, groupId);
  })();
}

export type ProfileTag = {
  id: number;
  label: string;
  scopeType: "instance" | "program" | "cohort";
  programId: number | null;
  cohortId: number | null;
  selfAssignable: boolean;
};

export function createProfileTag(
  actorUserId: number,
  input: Omit<ProfileTag, "id">,
  connection: DatabaseConnection = getDatabase(),
): ProfileTag {
  const actorId = idSchema.parse(actorUserId);
  const value = z
    .object({
      label: z.string().trim().min(1).max(40),
      scopeType: z.enum(["instance", "program", "cohort"]),
      programId: idSchema.optional().nullable(),
      cohortId: idSchema.optional().nullable(),
      selfAssignable: z.boolean(),
    })
    .parse(input);
  const authority = getAcademicAuthority(actorId, connection);
  if (value.scopeType === "instance" && authority.role !== "admin")
    throw new Error("Forbidden.");
  if (
    value.scopeType === "program" &&
    (!value.programId ||
      (authority.role !== "admin" &&
        !authority.programIds.includes(value.programId)))
  )
    throw new Error("Forbidden.");
  if (
    value.scopeType === "cohort" &&
    (!value.cohortId ||
      (authority.role !== "admin" &&
        !authority.cohortIds.includes(value.cohortId)))
  )
    throw new Error("Forbidden.");
  const id = Number(
    connection.sqlite
      .prepare(
        `insert into profile_tags
         (label, scope_type, program_id, cohort_id, self_assignable, created_by_user_id)
         values (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        value.label,
        value.scopeType,
        value.programId ?? null,
        value.cohortId ?? null,
        Number(value.selfAssignable),
        actorId,
      ).lastInsertRowid,
  );
  return {
    id,
    ...value,
    programId: value.programId ?? null,
    cohortId: value.cohortId ?? null,
  };
}

function eligibleForTag(
  userId: number,
  tag: ProfileTag,
  connection: DatabaseConnection,
): boolean {
  if (tag.scopeType === "instance") return true;
  const membership = connection.sqlite
    .prepare(
      "select program_id as programId, cohort_id as cohortId from user_academic_memberships where user_id = ?",
    )
    .get(userId) as { programId: number; cohortId: number | null } | undefined;
  return tag.scopeType === "program"
    ? membership?.programId === tag.programId
    : membership?.cohortId === tag.cohortId;
}

export function listEligibleProfileTags(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<ProfileTag & { assigned: boolean }> {
  const tags = connection.sqlite
    .prepare(
      `select pt.id, pt.label, pt.scope_type as scopeType,
              pt.program_id as programId, pt.cohort_id as cohortId,
              pt.self_assignable as selfAssignable,
              case when upt.user_id is null then 0 else 1 end as assigned
       from profile_tags pt
       left join user_profile_tags upt on upt.tag_id = pt.id and upt.user_id = ?
       where pt.archived_at is null order by pt.label collate nocase`,
    )
    .all(userId) as Array<ProfileTag & { assigned: number }>;
  return tags
    .map((tag) => ({
      ...tag,
      selfAssignable: Boolean(tag.selfAssignable),
      assigned: Boolean(tag.assigned),
    }))
    .filter((tag) => eligibleForTag(userId, tag, connection));
}

export function setOwnProfileTag(
  userId: number,
  tagId: number,
  assigned: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const tag = listEligibleProfileTags(userId, connection).find(
    ({ id }) => id === idSchema.parse(tagId),
  );
  if (!tag?.selfAssignable) throw new Error("Forbidden.");
  if (assigned) {
    connection.sqlite
      .prepare(
        `insert into user_profile_tags (user_id, tag_id, assigned_by_user_id)
         values (?, ?, ?) on conflict(user_id, tag_id) do nothing`,
      )
      .run(userId, tag.id, userId);
  } else {
    connection.sqlite
      .prepare("delete from user_profile_tags where user_id = ? and tag_id = ?")
      .run(userId, tag.id);
  }
}

export function listAssignedProfileTags(
  actorUserId: number,
  targetUserId: number,
  connection: DatabaseConnection = getDatabase(),
): ProfileTag[] {
  if (!canViewUser(actorUserId, targetUserId, connection)) {
    throw new Error("Forbidden.");
  }
  return connection.sqlite
    .prepare(
      `select pt.id, pt.label, pt.scope_type as scopeType,
              pt.program_id as programId, pt.cohort_id as cohortId,
              pt.self_assignable as selfAssignable
       from user_profile_tags upt
       join profile_tags pt on pt.id = upt.tag_id
       where upt.user_id = ? and pt.archived_at is null
       order by pt.label collate nocase`,
    )
    .all(targetUserId)
    .map((tag) => ({
      ...(tag as ProfileTag),
      selfAssignable: Boolean((tag as ProfileTag).selfAssignable),
    }));
}

function assertOwnerGroupMember(
  ownerUserId: number,
  groupId: number,
  connection: DatabaseConnection,
): void {
  if (
    !connection.sqlite
      .prepare(
        "select 1 from study_group_members where group_id = ? and user_id = ?",
      )
      .get(groupId, ownerUserId)
  )
    throw new Error("Forbidden.");
}

function notifyGroupShare(
  actorUserId: number,
  groupId: number,
  entityType: "note" | "document",
  entityId: number,
  title: string,
  connection: DatabaseConnection,
) {
  const members = connection.sqlite
    .prepare("select user_id as id from study_group_members where group_id = ?")
    .all(groupId) as Array<{ id: number }>;
  for (const member of members) {
    createNotification(
      member.id,
      {
        type: `${entityType}_shared`,
        actorUserId,
        entityType,
        entityId,
        title,
      },
      connection,
    );
  }
}

export function setNoteGroupShare(
  ownerUserId: number,
  noteId: number,
  groupId: number,
  shared: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(ownerUserId);
  const note = connection.sqlite
    .prepare(
      "select offering_id as offeringId, title from notes where id = ? and owner_user_id = ?",
    )
    .get(noteId, ownerId) as
    { offeringId: number | null; title: string } | undefined;
  if (!note) throw new Error("Note not found.");
  if (!note.offeringId) throw new Error("Private Notes cannot be shared.");
  assertOwnerGroupMember(ownerId, groupId, connection);
  if (shared) {
    connection.sqlite
      .prepare(
        `insert into note_group_shares (note_id, group_id, shared_by_user_id)
         values (?, ?, ?) on conflict(note_id, group_id) do nothing`,
      )
      .run(noteId, groupId, ownerId);
    notifyGroupShare(
      ownerId,
      groupId,
      "note",
      noteId,
      `Nota compartilhada: ${note.title}`,
      connection,
    );
  } else {
    connection.sqlite
      .prepare(
        "delete from note_group_shares where note_id = ? and group_id = ?",
      )
      .run(noteId, groupId);
  }
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action: shared ? "note.share" : "note.unshare",
      targetType: "note",
      targetId: String(noteId),
      summary: shared
        ? "subject note shared with group"
        : "subject note unshared from group",
    },
    connection,
  );
}

export function canReadNote(
  userId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  return Boolean(
    connection.sqlite
      .prepare(
        `select 1 from notes n where n.id = ? and (
          n.owner_user_id = ? or exists (
            select 1 from note_person_shares nps
            where nps.note_id = n.id and nps.recipient_user_id = ?
          ) or (n.offering_id is not null and exists (
            select 1 from note_group_shares ngs
            join study_group_members gm on gm.group_id = ngs.group_id
            where ngs.note_id = n.id and gm.user_id = ?
          )))`,
      )
      .get(noteId, userId, userId, userId),
  );
}

export function setDocumentGroupShare(
  ownerUserId: number,
  documentId: number,
  groupId: number,
  shared: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(ownerUserId);
  const document = connection.sqlite
    .prepare(
      "select name from generated_documents where id = ? and owner_user_id = ?",
    )
    .get(documentId, ownerId) as { name: string } | undefined;
  if (!document) throw new Error("Document not found.");
  assertOwnerGroupMember(ownerId, groupId, connection);
  if (shared) {
    connection.sqlite
      .prepare(
        `insert into document_group_shares
         (document_id, group_id, shared_by_user_id, google_permission_status)
         values (?, ?, ?, 'needs_authorization')
         on conflict(document_id, group_id) do nothing`,
      )
      .run(documentId, groupId, ownerId);
    notifyGroupShare(
      ownerId,
      groupId,
      "document",
      documentId,
      `Documento compartilhado: ${document.name}`,
      connection,
    );
  } else {
    connection.sqlite
      .prepare(
        "delete from document_group_shares where document_id = ? and group_id = ?",
      )
      .run(documentId, groupId);
  }
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action: shared ? "document.share" : "document.unshare",
      targetType: "generated_document",
      targetId: String(documentId),
      summary: shared
        ? "document shared with group"
        : "document unshared from group",
    },
    connection,
  );
}

export function canReadDocument(
  userId: number,
  documentId: number,
  connection: DatabaseConnection = getDatabase(),
): boolean {
  return Boolean(
    connection.sqlite
      .prepare(
        `select 1 from generated_documents d where d.id = ? and (
          d.owner_user_id = ? or exists (
            select 1 from document_person_shares dps
            where dps.document_id = d.id and dps.recipient_user_id = ?
          ) or exists (
            select 1 from document_group_shares dgs
            join study_group_members gm on gm.group_id = dgs.group_id
            where dgs.document_id = d.id and gm.user_id = ?
          ))`,
      )
      .get(documentId, userId, userId, userId),
  );
}

export function listUserSharedNoteIds(
  ownerUserId: number,
  connection: DatabaseConnection = getDatabase(),
): number[] {
  return (
    connection.sqlite
      .prepare(
        `select distinct n.id from notes n where n.owner_user_id=? and (
           exists(select 1 from note_group_shares s where s.note_id=n.id)
           or exists(select 1 from note_person_shares s where s.note_id=n.id)
         ) order by n.id`,
      )
      .all(idSchema.parse(ownerUserId)) as Array<{ id: number }>
  ).map(({ id }) => id);
}

export function listNoteGroupShares(
  ownerUserId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{ groupId: number; groupName: string }> {
  return connection.sqlite
    .prepare(
      `select g.id groupId,g.name groupName from note_group_shares s
       join notes n on n.id=s.note_id and n.owner_user_id=?
       join study_groups g on g.id=s.group_id where s.note_id=?
       order by g.name collate nocase`,
    )
    .all(idSchema.parse(ownerUserId), idSchema.parse(noteId)) as Array<{
    groupId: number;
    groupName: string;
  }>;
}

function assertShareRecipient(
  ownerId: number,
  recipientId: number,
  connection: DatabaseConnection,
) {
  if (
    ownerId === recipientId ||
    !connection.sqlite
      .prepare("SELECT 1 FROM users WHERE id=? AND active=1 AND role='member'")
      .get(recipientId)
  )
    throw new Error("Destinatário indisponível.");
}

export function setNotePersonShare(
  ownerUserId: number,
  noteId: number,
  recipientUserId: number,
  shared: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(ownerUserId);
  const recipientId = idSchema.parse(recipientUserId);
  const note = connection.sqlite
    .prepare("SELECT title FROM notes WHERE id=? AND owner_user_id=?")
    .get(idSchema.parse(noteId), ownerId) as { title: string } | undefined;
  if (!note) throw new Error("Nota indisponível.");
  if (shared) {
    assertShareRecipient(ownerId, recipientId, connection);
    const inserted = connection.sqlite
      .prepare(
        "INSERT INTO note_person_shares(note_id,recipient_user_id,shared_by_user_id) VALUES(?,?,?) ON CONFLICT DO NOTHING",
      )
      .run(noteId, recipientId, ownerId);
    if (inserted.changes)
      createNotification(
        recipientId,
        {
          type: "note_shared",
          actorUserId: ownerId,
          entityType: "note",
          entityId: noteId,
          title: `Nota compartilhada: ${note.title}`,
        },
        connection,
      );
  } else {
    connection.sqlite
      .prepare(
        "DELETE FROM note_person_shares WHERE note_id=? AND recipient_user_id=?",
      )
      .run(noteId, recipientId);
  }
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action: shared ? "note.share" : "note.unshare",
      targetType: "note",
      targetId: String(noteId),
      summary: "direct note access changed",
    },
    connection,
  );
}

export function listNotePersonShares(
  ownerUserId: number,
  noteId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{ userId: number; displayName: string }> {
  return connection.sqlite
    .prepare(
      `SELECT u.id userId,u.display_name displayName FROM note_person_shares s
     JOIN notes n ON n.id=s.note_id AND n.owner_user_id=?
     JOIN users u ON u.id=s.recipient_user_id WHERE s.note_id=?
     ORDER BY u.display_name COLLATE NOCASE`,
    )
    .all(idSchema.parse(ownerUserId), idSchema.parse(noteId)) as Array<{
    userId: number;
    displayName: string;
  }>;
}

export function setDocumentPersonShare(
  ownerUserId: number,
  documentId: number,
  recipientUserId: number,
  shared: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const ownerId = idSchema.parse(ownerUserId);
  const recipientId = idSchema.parse(recipientUserId);
  const document = connection.sqlite
    .prepare(
      "SELECT name FROM generated_documents WHERE id=? AND owner_user_id=?",
    )
    .get(idSchema.parse(documentId), ownerId) as { name: string } | undefined;
  if (!document) throw new Error("Documento indisponível.");
  if (shared) {
    assertShareRecipient(ownerId, recipientId, connection);
    const inserted = connection.sqlite
      .prepare(
        "INSERT INTO document_person_shares(document_id,recipient_user_id,shared_by_user_id,google_permission_status) VALUES(?,?,?,'needs_authorization') ON CONFLICT DO NOTHING",
      )
      .run(documentId, recipientId, ownerId);
    if (inserted.changes)
      createNotification(
        recipientId,
        {
          type: "document_shared",
          actorUserId: ownerId,
          entityType: "document",
          entityId: documentId,
          title: `Documento compartilhado: ${document.name}`,
          bodyPreview:
            "O acesso no Google Drive pode exigir autorização separada.",
        },
        connection,
      );
  } else {
    connection.sqlite
      .prepare(
        "DELETE FROM document_person_shares WHERE document_id=? AND recipient_user_id=?",
      )
      .run(documentId, recipientId);
  }
  recordAuditEvent(
    {
      actorUserId: ownerId,
      action: shared ? "document.share" : "document.unshare",
      targetType: "generated_document",
      targetId: String(documentId),
      summary: "direct document access changed",
    },
    connection,
  );
}

export function listDocumentPersonShares(
  ownerUserId: number,
  documentId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{
  userId: number;
  displayName: string;
  googlePermissionStatus: string;
}> {
  return connection.sqlite
    .prepare(
      `SELECT u.id userId,u.display_name displayName,s.google_permission_status googlePermissionStatus
     FROM document_person_shares s JOIN generated_documents d ON d.id=s.document_id AND d.owner_user_id=?
     JOIN users u ON u.id=s.recipient_user_id WHERE s.document_id=?
     ORDER BY u.display_name COLLATE NOCASE`,
    )
    .all(idSchema.parse(ownerUserId), idSchema.parse(documentId)) as Array<{
    userId: number;
    displayName: string;
    googlePermissionStatus: string;
  }>;
}

export function listDocumentGroupShares(
  ownerUserId: number,
  documentId: number,
  connection: DatabaseConnection = getDatabase(),
): Array<{
  groupId: number;
  groupName: string;
  googlePermissionStatus: string;
}> {
  return connection.sqlite
    .prepare(
      `SELECT g.id groupId,g.name groupName,s.google_permission_status googlePermissionStatus
     FROM document_group_shares s
     JOIN generated_documents d ON d.id=s.document_id AND d.owner_user_id=?
     JOIN study_groups g ON g.id=s.group_id WHERE s.document_id=?
     ORDER BY g.name COLLATE NOCASE`,
    )
    .all(idSchema.parse(ownerUserId), idSchema.parse(documentId)) as Array<{
    groupId: number;
    groupName: string;
    googlePermissionStatus: string;
  }>;
}
