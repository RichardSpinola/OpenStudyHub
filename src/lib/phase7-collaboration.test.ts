import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  canReadNote,
  canViewUser,
  createProfileTag,
  createStudyGroup,
  removeStudyGroupMember,
  setDocumentGroupShare,
  setNoteGroupShare,
  setOwnProfileTag,
  canReadDocument,
  setNotePersonShare,
  setDocumentPersonShare,
} from "./collaboration";
import {
  canAccessChatRoom,
  createAudienceRoom,
  createDirectRoom,
  deleteChatMessage,
  sendChatMessage,
} from "./chat";
import { renderChatMarkdown } from "./chat-markdown";
import { countUnreadNotifications } from "./notifications";
import { createNote, listSharedNotes } from "./notes";
import { updateFunctionalAuthority } from "./academic-authority";

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const insertUser = connection.sqlite.prepare(
    `insert into users
     (display_name, login, password_hash, role, active,
      password_changed_at, created_at, updated_at)
     values (?, ?, 'hash', ?, 1, ?, ?, ?)`,
  );
  const adminId = Number(
    insertUser.run("Admin", "admin", "admin", now, now, now).lastInsertRowid,
  );
  const ownerId = Number(
    insertUser.run("Owner", "owner", "member", now, now, now).lastInsertRowid,
  );
  const memberId = Number(
    insertUser.run("Member", "member", "member", now, now, now).lastInsertRowid,
  );
  const outsideId = Number(
    insertUser.run("Outside", "outside", "member", now, now, now)
      .lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Program')")
      .run().lastInsertRowid,
  );
  const otherProgramId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Other')")
      .run().lastInsertRowid,
  );
  const cohortId = Number(
    connection.sqlite
      .prepare("insert into cohorts (program_id, name) values (?, 'Cohort')")
      .run(programId).lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name) values ('Subject')")
      .run().lastInsertRowid,
  );
  const periodId = Number(
    connection.sqlite
      .prepare(
        "insert into academic_periods (label, starts_on, ends_on) values ('2030.1', '2030-01-01', '2030-06-30')",
      )
      .run().lastInsertRowid,
  );
  const offeringId = Number(
    connection.sqlite
      .prepare(
        "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
      )
      .run(subjectId, programId, periodId).lastInsertRowid,
  );
  const membership = connection.sqlite.prepare(
    "insert into user_academic_memberships (user_id, program_id, cohort_id) values (?, ?, ?)",
  );
  membership.run(ownerId, programId, cohortId);
  membership.run(memberId, programId, cohortId);
  membership.run(outsideId, otherProgramId, null);
  const enroll = connection.sqlite.prepare(
    "insert into enrollments (user_id, offering_id) values (?, ?)",
  );
  enroll.run(ownerId, offeringId);
  enroll.run(memberId, offeringId);
  return { adminId, ownerId, memberId, outsideId, programId, offeringId };
}

describe("Phase 7 collaboration authorization", () => {
  let connection: DatabaseConnection;
  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });
  afterEach(() => connection.close());

  it("limits group membership and Subject Note sharing to explicit members", () => {
    const { ownerId, memberId, outsideId, offeringId } = seed(connection);
    const group = createStudyGroup(
      ownerId,
      {
        name: "Study",
        subjectOfferingId: offeringId,
        memberUserIds: [memberId],
      },
      connection,
    );
    const note = createNote(
      ownerId,
      { title: "Shared", content: "content", offeringId },
      connection,
    );
    setNoteGroupShare(ownerId, note.id, group.id, true, connection);
    expect(canReadNote(memberId, note.id, connection)).toBe(true);
    expect(listSharedNotes(memberId, connection).map(({ id }) => id)).toEqual([
      note.id,
    ]);
    expect(listSharedNotes(outsideId, connection)).toEqual([]);
    expect(canReadNote(outsideId, note.id, connection)).toBe(false);
    setNoteGroupShare(ownerId, note.id, group.id, false, connection);
    expect(canReadNote(memberId, note.id, connection)).toBe(false);
    setNoteGroupShare(ownerId, note.id, group.id, true, connection);
    const groupRoom = connection.sqlite
      .prepare("select id from chat_rooms where group_id = ?")
      .get(group.id) as { id: number };
    removeStudyGroupMember(ownerId, group.id, memberId, connection);
    expect(canReadNote(memberId, note.id, connection)).toBe(false);
    expect(canAccessChatRoom(memberId, groupRoom.id, connection)).toBe(false);

    const privateNote = createNote(
      ownerId,
      { title: "Private", content: "", offeringId: null },
      connection,
    );
    expect(() =>
      setNoteGroupShare(ownerId, privateNote.id, group.id, true, connection),
    ).toThrow("Private Notes cannot be shared");
  });

  it("keeps visual tags separate from authorization", () => {
    const { adminId, ownerId, outsideId, programId } = seed(connection);
    const tag = createProfileTag(
      adminId,
      {
        label: "Monitor",
        scopeType: "instance",
        programId: null,
        cohortId: null,
        selfAssignable: true,
      },
      connection,
    );
    setOwnProfileTag(outsideId, tag.id, true, connection);
    expect(canViewUser(ownerId, outsideId, connection)).toBe(true);

    updateFunctionalAuthority(
      adminId,
      ownerId,
      "moderator",
      [programId],
      connection,
    );
    expect(() =>
      createProfileTag(
        ownerId,
        {
          label: "Program tag",
          scopeType: "program",
          programId,
          cohortId: null,
          selfAssignable: false,
        },
        connection,
      ),
    ).not.toThrow();
    expect(() =>
      createProfileTag(
        ownerId,
        {
          label: "Outside",
          scopeType: "instance",
          programId: null,
          cohortId: null,
          selfAssignable: false,
        },
        connection,
      ),
    ).toThrow("Forbidden");
  });

  it("enforces direct and dynamic audience access and safe messages", () => {
    const { adminId, ownerId, memberId, outsideId, programId } =
      seed(connection);
    const direct = createDirectRoom(ownerId, memberId, connection);
    expect(canAccessChatRoom(outsideId, direct.id, connection)).toBe(false);
    const message = sendChatMessage(
      ownerId,
      direct.id,
      {
        body: `<img src=x onerror=alert(1)> **ok** @[Member](user:${memberId})`,
      },
      connection,
    );
    expect(renderChatMarkdown(message.bodySource)).toContain("&lt;img");
    expect(renderChatMarkdown(message.bodySource)).not.toContain("<img");
    expect(countUnreadNotifications(memberId, connection)).toBe(1);
    expect(
      connection.sqlite
        .prepare(
          "select count(*) as count from chat_message_mentions where message_id = ?",
        )
        .get(message.id),
    ).toEqual({ count: 1 });
    sendChatMessage(
      memberId,
      direct.id,
      { body: "reply", replyToMessageId: message.id },
      connection,
    );
    expect(countUnreadNotifications(ownerId, connection)).toBe(1);
    expect(() => deleteChatMessage(memberId, message.id, connection)).toThrow(
      "Message not found",
    );

    const audience = createAudienceRoom(
      adminId,
      { name: "Program", audienceType: "program", programId },
      connection,
    );
    expect(canAccessChatRoom(ownerId, audience.id, connection)).toBe(true);
    expect(canAccessChatRoom(outsideId, audience.id, connection)).toBe(false);
    connection.sqlite
      .prepare("delete from user_academic_memberships where user_id = ?")
      .run(ownerId);
    expect(canAccessChatRoom(ownerId, audience.id, connection)).toBe(false);
  });

  it("accepts an image-only chat message without weakening empty-message validation", () => {
    const { ownerId, memberId } = seed(connection);
    const direct = createDirectRoom(ownerId, memberId, connection);
    const message = sendChatMessage(
      ownerId,
      direct.id,
      { body: "", hasAttachment: true },
      connection,
    );
    expect(message.bodySource).toBe("");
    expect(() =>
      sendChatMessage(ownerId, direct.id, { body: "" }, connection),
    ).toThrow("Message is empty");
  });

  it("keeps Hub document sharing explicit and reports Google authorization state", () => {
    const { ownerId, memberId, outsideId, offeringId } = seed(connection);
    const group = createStudyGroup(
      ownerId,
      {
        name: "Docs",
        subjectOfferingId: offeringId,
        memberUserIds: [memberId],
      },
      connection,
    );
    const documentId = Number(
      connection.sqlite
        .prepare(
          `insert into generated_documents
           (owner_user_id, offering_id, drive_file_id, web_view_link, name)
           values (?, ?, 'private-file', 'https://docs.google.com/document/d/private-file/edit', 'Document')`,
        )
        .run(ownerId, offeringId).lastInsertRowid,
    );
    setDocumentGroupShare(ownerId, documentId, group.id, true, connection);
    expect(canReadDocument(memberId, documentId, connection)).toBe(true);
    expect(canReadDocument(outsideId, documentId, connection)).toBe(false);
    expect(
      connection.sqlite
        .prepare(
          "select google_permission_status as status from document_group_shares where document_id = ? and group_id = ?",
        )
        .get(documentId, group.id),
    ).toEqual({ status: "needs_authorization" });
  });

  it("grants and revokes direct read access only by the owner", () => {
    const { ownerId, memberId, outsideId, offeringId } = seed(connection);
    const note = createNote(
      ownerId,
      { title: "Private", content: "secret", offeringId: null },
      connection,
    );
    expect(canReadNote(memberId, note.id, connection)).toBe(false);
    expect(() =>
      setNotePersonShare(outsideId, note.id, memberId, true, connection),
    ).toThrow();
    setNotePersonShare(ownerId, note.id, memberId, true, connection);
    expect(canReadNote(memberId, note.id, connection)).toBe(true);
    expect(canReadNote(outsideId, note.id, connection)).toBe(false);
    expect(listSharedNotes(memberId, connection).map(({ id }) => id)).toContain(
      note.id,
    );
    setNotePersonShare(ownerId, note.id, memberId, false, connection);
    expect(canReadNote(memberId, note.id, connection)).toBe(false);

    const documentId = Number(
      connection.sqlite
        .prepare(
          `INSERT INTO generated_documents(owner_user_id,offering_id,drive_file_id,web_view_link,name)
       VALUES(?,?,'fake-id','https://docs.google.com/document/d/fake-id/edit','Fake')`,
        )
        .run(ownerId, offeringId).lastInsertRowid,
    );
    expect(() =>
      setDocumentPersonShare(outsideId, documentId, memberId, true, connection),
    ).toThrow();
    setDocumentPersonShare(ownerId, documentId, memberId, true, connection);
    expect(canReadDocument(memberId, documentId, connection)).toBe(true);
    expect(canReadDocument(outsideId, documentId, connection)).toBe(false);
    setDocumentPersonShare(ownerId, documentId, memberId, false, connection);
    expect(canReadDocument(memberId, documentId, connection)).toBe(false);
  });
});
