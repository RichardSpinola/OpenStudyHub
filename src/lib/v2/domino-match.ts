import { randomBytes, randomUUID } from "node:crypto";
import type { V2Database } from "./database";
import {
  applyDominoAction,
  dominoView,
  newDominoRound,
  waitingDomino,
  type DominoAction,
  type DominoState,
  type Seat,
} from "../domino";

type Row = {
  id: string;
  inviteCode: string;
  ownerId: number;
  guestId: number | null;
  stateJson: string;
  version: number;
  updatedAt: number;
};
const select = `SELECT id,invite_code inviteCode,owner_id ownerId,guest_id guestId,state_json stateJson,version,updated_at updatedAt FROM domino_matches_v2`;
function rowById(db: V2Database, id: string): Row | undefined {
  return db.prepare(`${select} WHERE id=?`).get(id) as Row | undefined;
}
function member(row: Row, userId: number): Seat {
  if (row.ownerId === userId) return 0;
  if (row.guestId === userId) return 1;
  throw new Error("Partida indisponível.");
}
export function canAccessDominoMatch(
  db: V2Database,
  id: string,
  userId: number,
): boolean {
  const row = rowById(db, id);
  return !!row && (row.ownerId === userId || row.guestId === userId);
}
export function createDominoMatch(db: V2Database, userId: number) {
  const id = randomUUID();
  const inviteCode = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO domino_matches_v2(id,invite_code,owner_id,state_json,updated_at) VALUES(?,?,?,?,?)",
  ).run(id, inviteCode, userId, JSON.stringify(waitingDomino()), Date.now());
  return { id, inviteCode };
}
export function joinDominoMatch(
  db: V2Database,
  code: string,
  userId: number,
): string {
  return db.transaction(() => {
    const row = db.prepare(`${select} WHERE invite_code=?`).get(code) as
      Row | undefined;
    if (
      !row ||
      row.ownerId === userId ||
      row.guestId ||
      Date.now() - row.updatedAt > 24 * 60 * 60_000
    )
      throw new Error("Convite inválido ou indisponível.");
    const next = newDominoRound();
    const result = db
      .prepare(
        "UPDATE domino_matches_v2 SET guest_id=?,state_json=?,version=version+1,updated_at=? WHERE id=? AND guest_id IS NULL",
      )
      .run(userId, JSON.stringify(next), Date.now(), row.id);
    if (result.changes !== 1) throw new Error("O convite já foi usado.");
    return row.id;
  })();
}
export function dominoMatchView(db: V2Database, id: string, userId: number) {
  const row = rowById(db, id);
  if (!row) throw new Error("Partida indisponível.");
  const seat = member(row, userId);
  const state = JSON.parse(row.stateJson) as DominoState;
  const names = [row.ownerId, row.guestId].map((id) =>
    id === null
      ? "Aguardando convite"
      : ((
          db
            .prepare("SELECT display_name name FROM users WHERE id=?")
            .get(id) as { name: string } | undefined
        )?.name ?? "Jogador"),
  );
  return {
    id: row.id,
    seat,
    names,
    version: row.version,
    updatedAt: row.updatedAt,
    inviteCode: row.guestId === null && seat === 0 ? row.inviteCode : null,
    ...dominoView(state, seat),
  };
}
export function listDominoMatches(db: V2Database, userId: number) {
  const rows = db
    .prepare(
      `${select} WHERE owner_id=? OR guest_id=? ORDER BY updated_at DESC LIMIT 20`,
    )
    .all(userId, userId) as Row[];
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    updatedAt: row.updatedAt,
    phase: (JSON.parse(row.stateJson) as DominoState).phase,
    opponent:
      row.guestId === null
        ? "Aguardando convite"
        : (
            db
              .prepare("SELECT display_name name FROM users WHERE id=?")
              .get(row.ownerId === userId ? row.guestId : row.ownerId) as {
              name: string;
            }
          ).name,
  }));
}
export function actDominoMatch(
  db: V2Database,
  id: string,
  userId: number,
  version: number,
  action: DominoAction,
) {
  return db.transaction(() => {
    const row = rowById(db, id);
    if (!row) throw new Error("Partida indisponível.");
    const seat = member(row, userId);
    if (row.version !== version)
      throw new Error("Partida atualizada. Recarregue o tabuleiro.");
    const next = applyDominoAction(
      JSON.parse(row.stateJson) as DominoState,
      seat,
      action,
    );
    const updated = db
      .prepare(
        "UPDATE domino_matches_v2 SET state_json=?,version=version+1,updated_at=? WHERE id=? AND version=?",
      )
      .run(JSON.stringify(next), Date.now(), id, version);
    if (updated.changes !== 1)
      throw new Error("Partida atualizada. Recarregue o tabuleiro.");
    return dominoMatchView(db, id, userId);
  })();
}
