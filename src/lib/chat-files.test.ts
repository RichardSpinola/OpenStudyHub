import { it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createMigratedTestDatabase } from "./test-database";
import type { DatabaseConnection } from "./db/client";
import { saveChatAttachment, readChatAttachment } from "./chat-attachments";
import { chatWindow, deleteChatMessage } from "./chat";
import {
  readChatFormData,
  chatFileLimitBytes,
  chatRequestLimitBytes,
  validChatFilename,
} from "./chat-upload";
let db: DatabaseConnection, root: string;
beforeEach(async () => {
  db = createMigratedTestDatabase();
  root = await mkdtemp(join(tmpdir(), "osh-chat-files-"));
  db.sqlite.exec(
    "INSERT INTO users(id,display_name,login,password_hash,role,active) VALUES(1,'A','a','h','member',1),(2,'B','b','h','member',1),(3,'C','c','h','member',1); INSERT INTO chat_rooms(id,kind,created_by_user_id) VALUES(1,'direct',1); INSERT INTO chat_direct_members(room_id,user_id) VALUES(1,1),(1,2); INSERT INTO chat_messages(id,room_id,author_user_id,body_source,created_at) VALUES(1,1,1,'',1);",
  );
});
afterEach(async () => {
  db.close();
  await rm(root, { recursive: true, force: true });
});
it("stores named files privately, sends attachment changes and removes access after revocation/deletion", async () => {
  const cursor = chatWindow(2, 1, {}, db).revision;
  const data = Buffer.from("conteúdo fictício");
  const id = await saveChatAttachment(1, 1, 1, data, {
    connection: db,
    assetRoot: root,
    filename: "Resumo de aula.txt",
  });
  expect(
    (await readChatAttachment(2, id, { connection: db, assetRoot: root }))
      ?.data,
  ).toEqual(data);
  expect(
    (await readChatAttachment(2, id, { connection: db, assetRoot: root }))
      ?.mimeType,
  ).toBe("application/octet-stream");
  const updates = chatWindow(2, 1, { since: cursor }, db);
  expect(updates.messages[0].attachments?.[0].name).toBe("Resumo de aula.txt");
  expect(
    await readChatAttachment(3, id, { connection: db, assetRoot: root }),
  ).toBeNull();
  db.sqlite
    .prepare("DELETE FROM chat_direct_members WHERE room_id=1 AND user_id=2")
    .run();
  expect(
    await readChatAttachment(2, id, { connection: db, assetRoot: root }),
  ).toBeNull();
  deleteChatMessage(1, 1, db);
  expect(
    await readChatAttachment(1, id, { connection: db, assetRoot: root }),
  ).toBeNull();
});
it("keeps image validation and blocks forged/oversized/foreign uploads", async () => {
  const options = { connection: db, assetRoot: root };
  await expect(
    saveChatAttachment(1, 1, 1, Buffer.from("not png"), {
      ...options,
      filename: "falsa.png",
    }),
  ).rejects.toThrow();
  await expect(
    saveChatAttachment(3, 1, 1, Buffer.from("x"), {
      ...options,
      filename: "a.txt",
    }),
  ).rejects.toThrow();
  await expect(
    saveChatAttachment(1, 1, 1, Buffer.alloc(chatFileLimitBytes + 1), {
      ...options,
      filename: "a.txt",
    }),
  ).rejects.toThrow();
  expect(validChatFilename("../a.txt")).toBe(false);
  expect(validChatFilename("a\r\nb.txt")).toBe(false);
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const id = await saveChatAttachment(1, 1, 1, png, {
    ...options,
    filename: "foto.png",
  });
  expect((await readChatAttachment(2, id, options))?.mimeType).toBe(
    "image/png",
  );
});
it("forces HTML and SVG files into binary downloads rather than inline images", async () => {
  const id = await saveChatAttachment(
    1,
    1,
    1,
    Buffer.from('<svg onload="alert(1)"/>'),
    { connection: db, assetRoot: root, filename: "vetor.svg" },
  );
  expect(
    (await readChatAttachment(2, id, { connection: db, assetRoot: root }))
      ?.mimeType,
  ).toBe("application/octet-stream");
});
it("bounds streamed multipart bodies without trusting Content-Length and reads valid payloads", async () => {
  const form = new FormData();
  form.set("file", new File(["texto"], "a.txt"));
  form.set("body", "oi");
  const parsed = await readChatFormData(
    new Request("http://localhost", { method: "POST", body: form }),
  );
  expect(parsed.get("body")).toBe("oi");
  expect((parsed.get("file") as File).name).toBe("a.txt");
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(chatRequestLimitBytes + 1));
      c.close();
    },
  });
  await expect(
    readChatFormData(
      new Request("http://localhost", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
  ).rejects.toThrow("Envio grande demais.");
});
