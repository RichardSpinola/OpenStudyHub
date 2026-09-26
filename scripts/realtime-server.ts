import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { z } from "zod";
import { canAccessChatRoom } from "../src/lib/chat";
import { getDatabase } from "../src/lib/db/client";
import { sessionUserV2 } from "../src/lib/v2/auth";
import { openV2Database, migrateV2 } from "../src/lib/v2/database";
import {
  legacyChatUserId,
  sendChatMessageOnce,
} from "../src/lib/v2/chat-state";
import { USER_COOKIE, v2RuntimePath } from "../src/lib/v2/runtime-database";
import { extraAccessible, getExtrasFlags } from "../src/lib/v2/extras";
import { canAccessDominoMatch } from "../src/lib/v2/domino-match";
import {
  maxBoardPayloadBytes,
  readGlobalWhiteboard,
  updateGlobalWhiteboard,
  type BoardElement,
} from "../src/lib/v2/whiteboard";

if (
  process.env.OPENSTUDYHUB_V2_ENABLED !== "1" ||
  process.env.OPENSTUDYHUB_SURFACE !== "app"
) {
  throw new Error("Realtime requires the V2 normal app surface.");
}
const appOrigin = new URL(process.env.APP_URL ?? "").origin;
const host = process.env.REALTIME_HOST || "127.0.0.1";
const port = Number(process.env.REALTIME_PORT || 3045);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid realtime port.");
const expectedHost = new URL(
  process.env.REALTIME_PUBLIC_URL || `ws://${host}:${port}/realtime`,
).host;

type Peer = {
  socket: WebSocket;
  connectionId: string;
  token: string;
  canonicalId: number;
  legacyId: number;
  rooms: Set<number>;
  dominoMatches: Set<string>;
};
const peers = new Set<Peer>();
type WhiteboardPeer = {
  socket: WebSocket;
  connectionId: string;
  token: string;
  canonicalId: number;
  legacyId: number;
  name: string;
};
const whiteboardPeers = new Set<WhiteboardPeer>();
const wire = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    roomId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("unsubscribe"),
    roomId: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("typing"),
    roomId: z.number().int().positive(),
    active: z.boolean(),
  }),
  z.object({ type: z.literal("refresh"), roomId: z.number().int().positive() }),
  z.object({
    type: z.literal("send"),
    roomId: z.number().int().positive(),
    clientMessageId: z.string().uuid(),
    body: z.string().trim().min(1).max(10000),
    replyToMessageId: z.number().int().positive().nullable(),
  }),
  z.object({ type: z.literal("heartbeat") }),
  z.object({ type: z.literal("domino-subscribe"), matchId: z.string().uuid() }),
  z.object({
    type: z.literal("domino-unsubscribe"),
    matchId: z.string().uuid(),
  }),
  z.object({ type: z.literal("domino-refresh"), matchId: z.string().uuid() }),
]);

function withDb<T>(fn: (db: ReturnType<typeof openV2Database>) => T): T {
  const db = openV2Database(v2RuntimePath());
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
function principal(token: string) {
  return withDb((db) => {
    const user = sessionUserV2(db, token);
    if (!user || user.kind !== "user" || user.mustChangePassword) return null;
    return { canonicalId: user.id, legacyId: legacyChatUserId(db, user.id) };
  });
}
function cookieValue(raw: string, key: string): string | null {
  for (const item of raw.split(";")) {
    const [name, ...rest] = item.trim().split("=");
    if (name === key && rest.length) return rest.join("=");
  }
  return null;
}
function write(peer: Peer, value: unknown) {
  if (peer.socket.readyState === WebSocket.OPEN)
    peer.socket.send(JSON.stringify(value));
}
function heartbeat(peer: Peer) {
  const now = Date.now();
  withDb((db) => {
    db.prepare(
      "INSERT INTO realtime_connections(connection_id,user_id,last_heartbeat_at) VALUES(?,?,?) ON CONFLICT(connection_id) DO UPDATE SET last_heartbeat_at=excluded.last_heartbeat_at",
    ).run(peer.connectionId, peer.canonicalId, now);
    db.prepare(
      "INSERT INTO user_presence_seen(user_id,last_seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=excluded.last_seen_at",
    ).run(peer.canonicalId, now);
  });
}
function broadcast(roomId: number, event: unknown, except?: Peer) {
  for (const peer of peers) {
    if (peer === except || !peer.rooms.has(roomId)) continue;
    if (!canAccessChatRoom(peer.legacyId, roomId, getDatabase())) {
      peer.rooms.delete(roomId);
      continue;
    }
    write(peer, event);
  }
}
function broadcastNotification(roomId: number, except?: Peer) {
  for (const peer of peers) {
    if (peer === except) continue;
    if (canAccessChatRoom(peer.legacyId, roomId, getDatabase()))
      write(peer, { type: "notification" });
  }
}
const http = createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 404, {
    "content-type": "text/plain",
    "cache-control": "no-store",
  });
  response.end(request.url === "/health" ? "ok" : "not found");
});
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 65536,
  perMessageDeflate: false,
});
const boardWss = new WebSocketServer({
  noServer: true,
  maxPayload: maxBoardPayloadBytes + 65536,
  perMessageDeflate: false,
});
function boardEnabled() {
  return withDb((db) => extraAccessible(getExtrasFlags(db), "whiteboard"));
}
function boardPresence() {
  const participants = [...whiteboardPeers].map((peer) => ({
    id: peer.connectionId,
    legacyId: peer.legacyId,
    name: peer.name,
  }));
  const event = JSON.stringify({ type: "presence", participants });
  for (const peer of whiteboardPeers)
    if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(event);
}
function boardPatch(elements: BoardElement[]) {
  const event = JSON.stringify({ type: "patch", elements });
  for (const peer of whiteboardPeers)
    if (peer.socket.readyState === WebSocket.OPEN) peer.socket.send(event);
}
http.on("upgrade", (request, socket, head) => {
  try {
    if (
      (request.url !== "/realtime" && request.url !== "/whiteboard") ||
      request.headers.origin !== appOrigin ||
      request.headers.host !== expectedHost
    )
      throw new Error("Origin or host denied");
    const token = cookieValue(request.headers.cookie ?? "", USER_COOKIE);
    if (!token) throw new Error("No normal session");
    const user = principal(token);
    if (!user) throw new Error("Session denied");
    if (request.url === "/whiteboard") {
      if (!boardEnabled()) throw new Error("Whiteboard disabled");
      const name = withDb(
        (db) =>
          (
            db
              .prepare("SELECT display_name name FROM users WHERE id=?")
              .get(user.canonicalId) as { name: string }
          ).name,
      );
      boardWss.handleUpgrade(request, socket, head, (ws) =>
        boardWss.emit("connection", ws, { token, ...user, name }),
      );
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit("connection", ws, { token, ...user }),
    );
  } catch {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
  }
});
boardWss.on(
  "connection",
  (socket, identity: Omit<WhiteboardPeer, "socket" | "connectionId">) => {
    const peer: WhiteboardPeer = {
      socket,
      connectionId: randomUUID(),
      ...identity,
    };
    whiteboardPeers.add(peer);
    socket.send(
      JSON.stringify({ type: "scene", elements: withDb(readGlobalWhiteboard) }),
    );
    boardPresence();
    socket.on("message", (raw: RawData) => {
      try {
        const valid = principal(peer.token);
        if (
          !valid ||
          valid.canonicalId !== peer.canonicalId ||
          !boardEnabled()
        ) {
          socket.close(1008, "Access denied");
          return;
        }
        const message = JSON.parse(raw.toString()) as {
          type?: string;
          elements?: unknown;
        };
        if (message.type !== "patch") return;
        const incoming = message.elements as BoardElement[];
        const accepted = withDb((db) => {
          const elements = updateGlobalWhiteboard(db, incoming);
          const byId = new Map(
            elements.map((element) => [element.id, element]),
          );
          return incoming.flatMap((element) => {
            const saved = byId.get(element.id);
            return saved?.version === element.version &&
              Number(saved.versionNonce ?? 0) ===
                Number(element.versionNonce ?? 0)
              ? [saved]
              : [];
          });
        });
        if (accepted.length) boardPatch(accepted);
        socket.send(JSON.stringify({ type: "saved" }));
      } catch {
        socket.send(JSON.stringify({ type: "error" }));
      }
    });
    socket.on("close", () => {
      whiteboardPeers.delete(peer);
      boardPresence();
    });
    socket.on("error", () => {
      socket.close();
    });
  },
);
wss.on(
  "connection",
  (
    socket,
    identity: { token: string; canonicalId: number; legacyId: number },
  ) => {
    const peer: Peer = {
      socket,
      connectionId: randomUUID(),
      rooms: new Set(),
      dominoMatches: new Set(),
      ...identity,
    };
    peers.add(peer);
    heartbeat(peer);
    write(peer, { type: "ready" });
    socket.on("message", (raw: RawData) => {
      try {
        const data = wire.parse(JSON.parse(raw.toString()));
        const stillValid = principal(peer.token);
        if (!stillValid || stillValid.canonicalId !== peer.canonicalId) {
          socket.close(1008, "Session expired");
          return;
        }
        if (data.type === "heartbeat") {
          heartbeat(peer);
          write(peer, { type: "heartbeat" });
          return;
        }
        if (
          data.type === "domino-subscribe" ||
          data.type === "domino-unsubscribe" ||
          data.type === "domino-refresh"
        ) {
          const matchId = data.matchId;
          const allowed = withDb(
            (db) =>
              extraAccessible(getExtrasFlags(db), "domino") &&
              canAccessDominoMatch(db, matchId, peer.canonicalId),
          );
          if (!allowed) {
            write(peer, { type: "error", reason: "forbidden" });
            return;
          }
          if (data.type === "domino-subscribe") peer.dominoMatches.add(matchId);
          else if (data.type === "domino-unsubscribe")
            peer.dominoMatches.delete(matchId);
          else
            for (const other of peers) {
              if (
                other.dominoMatches.has(matchId) &&
                withDb((db) =>
                  canAccessDominoMatch(db, matchId, other.canonicalId),
                )
              )
                write(other, { type: "domino-refresh", matchId });
            }
          return;
        }
        if (data.type === "unsubscribe") {
          peer.rooms.delete(data.roomId);
          return;
        }
        if (!canAccessChatRoom(peer.legacyId, data.roomId, getDatabase())) {
          write(peer, { type: "error", reason: "forbidden" });
          return;
        }
        if (data.type === "subscribe") {
          peer.rooms.add(data.roomId);
          write(peer, { type: "subscribed", roomId: data.roomId });
          return;
        }
        if (!peer.rooms.has(data.roomId)) {
          write(peer, { type: "error", reason: "subscribe-first" });
          return;
        }
        if (data.type === "typing") {
          broadcast(
            data.roomId,
            {
              type: "typing",
              roomId: data.roomId,
              userId: peer.legacyId,
              active: data.active,
            },
            peer,
          );
          return;
        }
        if (data.type === "refresh") {
          broadcast(data.roomId, { type: "message", roomId: data.roomId });
          broadcastNotification(data.roomId, peer);
          return;
        }
        const result = sendChatMessageOnce(
          peer.canonicalId,
          peer.legacyId,
          data.roomId,
          data.clientMessageId,
          data.body,
          data.replyToMessageId,
        );
        write(peer, {
          type: "sent",
          roomId: data.roomId,
          clientMessageId: data.clientMessageId,
          messageId: result.messageId,
        });
        broadcast(data.roomId, {
          type: "message",
          roomId: data.roomId,
          messageId: result.messageId,
        });
        broadcastNotification(data.roomId, peer);
      } catch {
        write(peer, { type: "error", reason: "invalid-event" });
      }
    });
    socket.on("close", () => {
      peers.delete(peer);
    });
    socket.on("error", () => {
      peers.delete(peer);
    });
  },
);
setInterval(() => {
  const cutoff = Date.now() - 45_000;
  withDb((db) =>
    db
      .prepare("DELETE FROM realtime_connections WHERE last_heartbeat_at<?")
      .run(cutoff),
  );
  for (const peer of peers) {
    if (!principal(peer.token)) {
      peer.socket.close(1008, "Session expired");
      continue;
    }
    heartbeat(peer);
    peer.socket.ping();
  }
  for (const peer of whiteboardPeers) {
    const valid = principal(peer.token);
    if (!valid || valid.canonicalId !== peer.canonicalId || !boardEnabled())
      peer.socket.close(1008, "Access denied");
    else peer.socket.ping();
  }
}, 20_000).unref();

withDb(migrateV2);
http.listen(port, host, () => console.log(`Realtime ready on ${host}:${port}`));
