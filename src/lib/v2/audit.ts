import type { V2Database } from "./database";
import type { Actor } from "./actor";

// No free-form metadata: callers cannot accidentally persist secrets or private content.
export function recordAdminAction(
  db: V2Database,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: number,
): void {
  if (
    !/^[a-z][a-z0-9_.]{0,79}$/.test(action) ||
    !/^[a-z][a-z0-9_]{0,39}$/.test(targetType)
  ) {
    throw new Error("Invalid audit action");
  }
  db.prepare(
    "INSERT INTO admin_audit_events(actor_admin_id,actor_user_id,action,target_type,target_id) VALUES(?,?,?,?,?)",
  ).run(
    actor.kind === "admin" ? actor.id : null,
    actor.kind === "user" ? actor.id : null,
    action,
    targetType,
    targetId,
  );
}
