import { describe, expect, it } from "vitest";
import { migrateV2, openV2Database } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  actDominoMatch,
  canAccessDominoMatch,
  createDominoMatch,
  dominoMatchView,
  joinDominoMatch,
} from "./domino-match";

describe("partida privada", () => {
  it("exige convite, esconde mãos e serializa jogadas concorrentes", () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      seedV2Fake(db);
      const match = createDominoMatch(db, 3);
      expect(canAccessDominoMatch(db, match.id, 4)).toBe(false);
      expect(() => joinDominoMatch(db, match.inviteCode, 3)).toThrow();
      joinDominoMatch(db, match.inviteCode, 4);
      expect(() => joinDominoMatch(db, match.inviteCode, 4)).toThrow();
      const owner = dominoMatchView(db, match.id, 3);
      const guest = dominoMatchView(db, match.id, 4);
      expect(owner.hand).not.toEqual(guest.hand);
      expect(owner.opponentCount).toBe(7);
      const starter = owner.turn === 0 ? 3 : 4;
      const view = starter === 3 ? owner : guest;
      const tile = view.openingTile!;
      const next = actDominoMatch(db, match.id, starter, view.version, {
        type: "play",
        tile,
        side: "left",
      });
      expect(next.chain).toHaveLength(1);
      expect(() =>
        actDominoMatch(db, match.id, starter, view.version, {
          type: "play",
          tile,
          side: "left",
        }),
      ).toThrow("atualizada");
    } finally {
      db.close();
    }
  });
});
