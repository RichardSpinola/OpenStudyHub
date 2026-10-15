import { beforeEach, afterEach, it, expect } from "vitest";
import { createMigratedTestDatabase } from "./test-database";
import type { DatabaseConnection } from "./db/client";
import { chatWindow, editChatMessage, deleteChatMessage } from "./chat";
import { canModerateRoom, reportChatMessage } from "./chat-moderation";
import { canManageChatRoomAvatar } from "./v2/chat-room-avatar";
let db: DatabaseConnection;
beforeEach(() => {
  db = createMigratedTestDatabase();
  db.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role,active) VALUES(1,'Ana','ana','h','member',1),(2,'Bia','bia','h','member',1),(3,'Admin','admin','h','admin',1);INSERT INTO chat_rooms(id,kind,name,created_by_user_id) VALUES(1,'audience','Global',1),(2,'direct',NULL,1);INSERT INTO chat_room_audiences(room_id,audience_type) VALUES(1,'instance');INSERT INTO chat_direct_members(room_id,user_id) VALUES(2,1),(2,2);",
  );
});
afterEach(() => db.close());
function message(room = 1, body = "Mensagem") {
  return Number(
    db.sqlite
      .prepare(
        "INSERT INTO chat_messages(room_id,author_user_id,body_source,created_at) VALUES(?,1,?,?)",
      )
      .run(room, body, Date.now()).lastInsertRowid,
  );
}
it("loads latest messages and pages earlier without overlaps", () => {
  for (let i = 0; i < 120; i++) message(1, String(i));
  const last = chatWindow(2, 1, {}, db);
  expect(last.messages).toHaveLength(50);
  expect(last.messages[0].bodySource).toBe("70");
  expect(last.messages.at(-1)?.bodySource).toBe("119");
  const previous = chatWindow(2, 1, { before: last.messages[0].id }, db);
  expect(previous.messages[0].bodySource).toBe("20");
  expect(previous.messages.at(-1)?.bodySource).toBe("69");
  expect(previous.hasOlder).toBe(true);
});
it("delivers edits and deletion tombstones after reconnection without treating them as new IDs", () => {
  const id = message();
  const initial = chatWindow(2, 1, {}, db);
  editChatMessage(1, id, "Editada", db);
  const changed = chatWindow(2, 1, { since: initial.revision }, db);
  expect(changed.messages[0].bodySource).toBe("Editada");
  deleteChatMessage(1, id, db);
  expect(chatWindow(2, 1, { since: changed.revision }, db).removedIds).toEqual([
    id,
  ]);
  expect(chatWindow(2, 1, { since: changed.revision }, db).messages).toEqual(
    [],
  );
});
it("global creator cannot change the global photo and regular members cannot moderate", () => {
  const id = message();
  expect(canManageChatRoomAvatar(1, 1, db)).toBe(false);
  expect(canManageChatRoomAvatar(3, 1, db)).toBe(true);
  expect(canModerateRoom(2, 1, db)).toBe(false);
  expect(() => deleteChatMessage(2, id, db)).toThrow();
  deleteChatMessage(3, id, db);
  expect(chatWindow(2, 1, {}, db).messages).toEqual([]);
});
it("private conversations stay private and a report copies only the selected message", () => {
  const first = message(2, "Selecionada");
  message(2, "Privada não denunciada");
  expect(() => chatWindow(3, 2, {}, db)).toThrow();
  expect(canModerateRoom(3, 2, db)).toBe(false);
  const report = reportChatMessage(2, 2, first, "Contexto inadequado", db);
  expect(reportChatMessage(2, 2, first, "Outro motivo", db)).toBe(report);
  expect(db.sqlite.prepare("SELECT excerpt FROM chat_reports").all()).toEqual([
    { excerpt: "Selecionada" },
  ]);
  db.sqlite
    .prepare("DELETE FROM chat_direct_members WHERE room_id=2 AND user_id=1")
    .run();
  expect(() => editChatMessage(1, first, "X", db)).toThrow();
  expect(() => deleteChatMessage(1, first, db)).toThrow();
});
