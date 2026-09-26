import { describe, expect, it } from "vitest";
import { migrateV2, openV2Database } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  checkGoogleHealthForUser,
  dismissGoogleHealthIncident,
  googleHealthStatus,
  runGoogleHealthChecks,
} from "./google-health";

describe("estado Google", () => {
  it("separa revogação de falha temporária e volta a avisar em novo incidente", async () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      seedV2Fake(db);
      db.prepare(
        "INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at) VALUES(3,'sub','fake','scope','connected',10)",
      ).run();
      await runGoogleHealthChecks(db, 100, async () => {
        throw new Error("rede indisponível");
      });
      expect(googleHealthStatus(db, 3).result).toBe("temporary_error");
      expect(googleHealthStatus(db, 3).attention).toBe(false);
      expect(
        await checkGoogleHealthForUser(db, 3, 200, async () => "valid"),
      ).toBe(false);
      expect(
        await checkGoogleHealthForUser(db, 3, 3_600_101, async () => "valid"),
      ).toBe(true);
      expect(googleHealthStatus(db, 3).result).toBe("ready");
      db.prepare(
        "UPDATE google_connections_v2 SET status='needs_reconnect',updated_at=200 WHERE user_id=3",
      ).run();
      expect(googleHealthStatus(db, 3).attention).toBe(true);
      dismissGoogleHealthIncident(db, 3);
      expect(googleHealthStatus(db, 3).attention).toBe(false);
      db.prepare(
        "UPDATE google_connections_v2 SET status='connected',updated_at=300 WHERE user_id=3",
      ).run();
      db.prepare(
        "UPDATE google_connections_v2 SET status='needs_reconnect',updated_at=400 WHERE user_id=3",
      ).run();
      expect(googleHealthStatus(db, 3).attention).toBe(true);
    } finally {
      db.close();
    }
  });
});
