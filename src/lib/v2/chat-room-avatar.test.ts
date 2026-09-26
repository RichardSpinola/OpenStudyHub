import { afterEach, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMigratedTestDatabase } from "@/lib/test-database";
import {
  canManageChatRoomAvatar,
  readChatRoomAvatar,
  saveChatRoomAvatar,
} from "./chat-room-avatar";

const priorEnabled = process.env.OPENSTUDYHUB_V2_ENABLED;
const priorPath = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
const roots: string[] = [];
afterEach(() => {
  if (priorEnabled === undefined) delete process.env.OPENSTUDYHUB_V2_ENABLED;
  else process.env.OPENSTUDYHUB_V2_ENABLED = priorEnabled;
  if (priorPath === undefined) delete process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
  else process.env.OPENSTUDYHUB_V2_DATABASE_PATH = priorPath;
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it("allows only the group owner to set a room image and only members to read it", () => {
  const root = mkdtempSync(join(tmpdir(), "osh-room-avatar-"));
  roots.push(root);
  process.env.OPENSTUDYHUB_V2_ENABLED = "1";
  process.env.OPENSTUDYHUB_V2_DATABASE_PATH = join(root, "v2.db");
  const connection = createMigratedTestDatabase();
  try {
    connection.sqlite.exec(`
      INSERT INTO users(id,display_name,login,password_hash,role) VALUES
      (1,'A','a.fake','hash','member'),
      (2,'B','b.fake','hash','member'),
      (3,'C','c.fake','hash','member');
      INSERT INTO study_groups(id,name,created_by_user_id,created_at,updated_at)
      VALUES(10,'Grupo',1,1,1);
      INSERT INTO study_group_members(group_id,user_id,member_role,joined_at)
      VALUES(10,1,'owner',1),(10,2,'member',1);
      INSERT INTO chat_rooms(id,kind,name,group_id,created_by_user_id,created_at)
      VALUES(20,'group','Grupo',10,1,1);
    `);
    expect(canManageChatRoomAvatar(1, 20, connection)).toBe(true);
    expect(canManageChatRoomAvatar(2, 20, connection)).toBe(false);
    expect(canManageChatRoomAvatar(3, 20, connection)).toBe(false);
    const image = Buffer.from("imagem fictícia");
    saveChatRoomAvatar(1, 20, image, "image/png", connection);
    expect(readChatRoomAvatar(2, 20, connection)?.image).toEqual(image);
    expect(readChatRoomAvatar(3, 20, connection)).toBeNull();
    expect(() =>
      saveChatRoomAvatar(2, 20, image, "image/png", connection),
    ).toThrow();
  } finally {
    connection.close();
  }
});
