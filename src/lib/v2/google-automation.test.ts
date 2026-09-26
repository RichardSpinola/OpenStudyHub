import { describe, expect, it } from "vitest";

import { adminActor, userActor } from "./actor";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  googleAutomationStatus,
  runDueGoogleAutomation,
  setGoogleAutomationInterval,
} from "./google-automation";

describe("Google automation scheduling", () => {
  it("lets Admin change the interval and runs only when due", async () => {
    const db = openV2Database(":memory:");
    try {
      migrateV2(db);
      seedV2Fake(db);
      expect(() => setGoogleAutomationInterval(db, userActor(3), 15)).toThrow(
        "Somente Admin",
      );
      setGoogleAutomationInterval(db, adminActor(1), 15);
      expect(googleAutomationStatus(db).intervalMinutes).toBe(15);
      const now = Date.now();
      db.prepare(
        "UPDATE google_automation_v2 SET last_run_at=? WHERE id=1",
      ).run(now - 16 * 60_000);
      expect(await runDueGoogleAutomation(db, now)).toBe(true);
      expect(googleAutomationStatus(db).driveStatus).toBe("pending");
      expect(await runDueGoogleAutomation(db, now + 60_000)).toBe(false);
      setGoogleAutomationInterval(db, adminActor(1), 0);
      expect(await runDueGoogleAutomation(db, now + 60 * 60_000)).toBe(false);
    } finally {
      db.close();
    }
  });
});
