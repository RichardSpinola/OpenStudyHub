import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import { saveChatAttachment, readChatAttachment } from "./chat-attachments";
import { createDirectRoom, sendChatMessage } from "./chat";

describe("Phase 7 private chat assets", () => {
  let connection: DatabaseConnection;
  let root: string;
  let userA: number;
  let userB: number;
  let outsider: number;

  beforeEach(async () => {
    connection = createMigratedTestDatabase();
    root = await mkdtemp(join(tmpdir(), "osh-phase7-"));
    const now = Date.now();
    const insert = connection.sqlite.prepare(
      `insert into users
       (display_name, login, password_hash, role, active, password_changed_at, created_at, updated_at)
       values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
    );
    userA = Number(insert.run("A", "a", now, now, now).lastInsertRowid);
    userB = Number(insert.run("B", "b", now, now, now).lastInsertRowid);
    outsider = Number(insert.run("C", "c", now, now, now).lastInsertRowid);
    const programId = Number(
      connection.sqlite
        .prepare("insert into programs (name) values ('P')")
        .run().lastInsertRowid,
    );
    const membership = connection.sqlite.prepare(
      "insert into user_academic_memberships (user_id, program_id) values (?, ?)",
    );
    membership.run(userA, programId);
    membership.run(userB, programId);
  });

  afterEach(async () => {
    connection.close();
    await rm(root, { recursive: true, force: true });
  });

  it("decodes and serves an image only to room members", async () => {
    const room = createDirectRoom(userA, userB, connection);
    const message = sendChatMessage(
      userA,
      room.id,
      { body: "image" },
      connection,
    );
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const attachmentId = await saveChatAttachment(
      userA,
      room.id,
      message.id,
      image,
      { connection, assetRoot: root },
    );
    await expect(
      readChatAttachment(userB, attachmentId, { connection, assetRoot: root }),
    ).resolves.toMatchObject({ mimeType: "image/png" });
    await expect(
      readChatAttachment(outsider, attachmentId, {
        connection,
        assetRoot: root,
      }),
    ).resolves.toBeNull();
    await expect(
      saveChatAttachment(userA, room.id, message.id, image, {
        connection,
        assetRoot: root,
      }),
    ).rejects.toThrow("already has an attachment");
    await expect(
      saveChatAttachment(userA, room.id, message.id, Buffer.from("not-image"), {
        connection,
        assetRoot: root,
      }),
    ).rejects.toThrow("Invalid image");
  });
});
