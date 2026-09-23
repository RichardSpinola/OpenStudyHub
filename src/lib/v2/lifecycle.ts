import type { V2Database } from "./database";
import { isAdmin } from "./access";
import { recordAdminAction } from "./audit";
import type { Actor } from "./actor";

export function deactivateUser(
  db: V2Database,
  actor: Actor,
  userId: number,
): void {
  if (!isAdmin(db, actor)) throw new Error("Admin required");
  db.transaction(() => {
    if (
      db
        .prepare("UPDATE users SET active=0 WHERE id=? AND active=1")
        .run(userId).changes !== 1
    )
      throw new Error("User missing or inactive");
    db.prepare(
      "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
    ).run(Date.now(), userId);
    recordAdminAction(db, actor, "user.deactivate", "user", userId);
  })();
}
