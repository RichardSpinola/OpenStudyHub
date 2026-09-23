import type { V2Database } from "./database";
import { recordAdminAction } from "./audit";
import type { Actor } from "./actor";

export type Capability =
  | "manage_academics"
  | "manage_cohort"
  | "manage_schedule"
  | "manage_enrollments"
  | "moderate_chat";
export type Scope = {
  kind: "institution" | "program" | "cohort" | "offering" | "group";
  id: number;
};
const scopeColumns = {
  institution: "institution_id",
  program: "program_id",
  cohort: "cohort_id",
  offering: "offering_id",
  group: "group_id",
} as const;
const capabilities: Capability[] = [
  "manage_academics",
  "manage_cohort",
  "manage_schedule",
  "manage_enrollments",
  "moderate_chat",
];

export function isAdmin(db: V2Database, actor: Actor): boolean {
  if (actor.kind !== "admin") return false;
  return !!db
    .prepare("SELECT 1 FROM admin_accounts WHERE id=? AND active=1")
    .get(actor.id);
}

function scopeAncestors(db: V2Database, scope: Scope): Scope[] {
  if (scope.kind === "institution" || scope.kind === "group") return [scope];
  if (scope.kind === "program") {
    const row = db
      .prepare("SELECT institution_id id FROM programs WHERE id=?")
      .get(scope.id) as { id: number } | undefined;
    return row ? [scope, { kind: "institution", id: row.id }] : [];
  }
  if (scope.kind === "cohort") {
    const row = db
      .prepare("SELECT program_id id FROM cohorts WHERE id=?")
      .get(scope.id) as { id: number } | undefined;
    return row
      ? [scope, ...scopeAncestors(db, { kind: "program", id: row.id })]
      : [];
  }
  const row = db
    .prepare("SELECT program_id id FROM offerings WHERE id=?")
    .get(scope.id) as { id: number } | undefined;
  return row
    ? [scope, ...scopeAncestors(db, { kind: "program", id: row.id })]
    : [];
}

export function canManage(
  db: V2Database,
  actor: Actor,
  capability: Capability,
  scope: Scope,
): boolean {
  if (!capabilities.includes(capability)) return false;
  if (isAdmin(db, actor)) return true;
  if (actor.kind !== "user") return false;
  const active = db
    .prepare("SELECT 1 FROM users WHERE id=? AND active=1")
    .get(actor.id);
  if (!active) return false;
  for (const ancestor of scopeAncestors(db, scope)) {
    if (
      db
        .prepare(
          `SELECT 1 FROM permission_grants WHERE user_id=? AND capability=? AND ${scopeColumns[ancestor.kind]}=? AND revoked_at IS NULL`,
        )
        .get(actor.id, capability, ancestor.id)
    )
      return true;
  }
  return false;
}

export function grant(
  db: V2Database,
  actor: Actor,
  userId: number,
  capability: Capability,
  scope: Scope,
): number {
  if (!isAdmin(db, actor)) throw new Error("Admin required");
  if (
    !Object.hasOwn(scopeColumns, scope.kind) ||
    !capabilities.includes(capability) ||
    !scopeAncestors(db, scope).length
  )
    throw new Error("Invalid grant");
  if (scope.kind === "group" && capability !== "moderate_chat")
    throw new Error("Group scope only permits chat moderation");
  if (scope.kind !== "group" && capability === "moderate_chat") {
    // Program/cohort moderation is valid; institution-wide is intentionally not delegated here.
    if (scope.kind === "institution" || scope.kind === "offering")
      throw new Error("Invalid moderation scope");
  }
  return db.transaction(() => {
    const existing = db
      .prepare(
        `SELECT id FROM permission_grants WHERE user_id=? AND capability=? AND ${scopeColumns[scope.kind]}=? AND revoked_at IS NULL`,
      )
      .get(userId, capability, scope.id) as { id: number } | undefined;
    if (existing) return existing.id;
    const result = db
      .prepare(
        `INSERT INTO permission_grants(user_id,capability,${scopeColumns[scope.kind]},granted_by_admin_id) VALUES(?,?,?,?)`,
      )
      .run(userId, capability, scope.id, actor.id);
    const id = Number(result.lastInsertRowid);
    recordAdminAction(db, actor, "grant.create", "permission_grant", id);
    return id;
  })();
}

export function revokeGrant(
  db: V2Database,
  actor: Actor,
  grantId: number,
): void {
  if (!isAdmin(db, actor)) throw new Error("Admin required");
  db.transaction(() => {
    const result = db
      .prepare(
        "UPDATE permission_grants SET revoked_at=? WHERE id=? AND revoked_at IS NULL",
      )
      .run(Date.now(), grantId);
    if (result.changes !== 1) throw new Error("Grant not active");
    recordAdminAction(db, actor, "grant.revoke", "permission_grant", grantId);
  })();
}

// Administrative authority is intentionally absent from this content ACL.
export function canReadPrivate(
  ownerId: number,
  viewerId: number,
  explicitlySharedWith: ReadonlySet<number>,
): boolean {
  return ownerId === viewerId || explicitlySharedWith.has(viewerId);
}
