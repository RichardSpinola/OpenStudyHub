import { createHash } from "node:crypto";

import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  getDummyPasswordHash,
  hashPassword,
  localPasswordSchema,
  verifyPassword,
} from "@/lib/password";
import type { AuthenticatedUser } from "@/lib/session";
import { revokeUserSessions } from "@/lib/session";
import { defaultStorageLayout } from "@/lib/storage-layout";
import { defaultNotificationPreferences } from "@/lib/notifications";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;

export const userRoleSchema = z.enum(["admin", "member"]);
export const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._@+-]*$/u);
export const displayNameSchema = z.string().trim().min(2).max(120);

const bootstrapInputSchema = z.object({
  displayName: displayNameSchema,
  login: loginSchema,
  password: localPasswordSchema,
  institutionName: z.string().trim().max(160).optional().default(""),
  language: z.enum(["pt-BR", "en"]),
  academic: z
    .object({
      programName: z.string().trim().min(1).max(160),
      programShortName: z.string().trim().max(40).optional().default(""),
      cohortName: z.string().trim().max(160).optional().default(""),
      periodLabel: z.string().trim().min(1).max(80),
      periodStartsOn: z.iso.date(),
      periodEndsOn: z.iso.date(),
      subjectName: z.string().trim().min(1).max(160),
      expectedPeriods: z.number().int().min(1).max(20).optional().nullable(),
      includeCohortInStorage: z.boolean().default(true),
    })
    .refine(
      ({ periodStartsOn, periodEndsOn }) => periodStartsOn <= periodEndsOn,
    )
    .optional(),
});

const memberInputSchema = z.object({
  displayName: displayNameSchema,
  login: loginSchema,
  password: localPasswordSchema,
});

export type BootstrapInput = z.input<typeof bootstrapInputSchema>;
export type CreateMemberInput = z.input<typeof memberInputSchema>;

export type UserRecord = AuthenticatedUser & {
  active: boolean;
  lastLoginAt: number | null;
  createdAt: number;
  updatedAt: number;
};

function loginRateKey(login: string): string {
  return createHash("sha256").update(`login:${login}`).digest("hex");
}

function findUserForAuthentication(
  login: string,
  connection: DatabaseConnection,
): (UserRecord & { passwordHash: string }) | null {
  return (
    (connection.sqlite
      .prepare(
        `select
           id,
           display_name as displayName,
           login,
           password_hash as passwordHash,
           role,
           active,
           last_login_at as lastLoginAt,
           created_at as createdAt,
           updated_at as updatedAt
         from users where login = ?`,
      )
      .get(login) as (UserRecord & { passwordHash: string }) | undefined) ??
    null
  );
}

export function isSetupRequired(
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const result = connection.sqlite
    .prepare("select count(*) as count from users where role = 'admin'")
    .get() as { count: number };
  return result.count === 0;
}

export async function bootstrapFirstAdmin(
  input: BootstrapInput,
  connection: DatabaseConnection = getDatabase(),
): Promise<AuthenticatedUser> {
  const value = bootstrapInputSchema.parse(input);
  const passwordHash = await hashPassword(value.password);

  const bootstrap = connection.sqlite.transaction(() => {
    if (!isSetupRequired(connection)) {
      throw new Error("Setup is already complete.");
    }

    const now = Date.now();
    const result = connection.sqlite
      .prepare(
        `insert into users
         (display_name, locale, login, password_hash, role, active,
          notification_preferences_json, password_changed_at, created_at, updated_at)
         values (?, ?, ?, ?, 'admin', 1, ?, ?, ?, ?)`,
      )
      .run(
        value.displayName,
        value.language,
        value.login,
        passwordHash,
        JSON.stringify(defaultNotificationPreferences),
        now,
        now,
        now,
      );
    const userId = Number(result.lastInsertRowid);

    connection.sqlite
      .prepare(
        `insert into app_settings (key, value, updated_at)
         values ('ui.language', ?, ?)
         on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(value.language, now);

    if (value.institutionName) {
      connection.sqlite
        .prepare(
          `insert into app_settings (key, value, updated_at)
           values ('institution.display_name', ?, ?)
           on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at`,
        )
        .run(value.institutionName, now);
    }

    if (value.academic) {
      const program = connection.sqlite
        .prepare(
          `insert into programs (name, short_name, created_at, updated_at)
           values (?, ?, ?, ?)`,
        )
        .run(
          value.academic.programName,
          value.academic.programShortName || null,
          now,
          now,
        );
      const programId = Number(program.lastInsertRowid);
      let cohortId: number | null = null;
      if (value.academic.cohortName) {
        cohortId = Number(
          connection.sqlite
            .prepare(
              `insert into cohorts
               (program_id, name, created_at, updated_at)
               values (?, ?, ?, ?)`,
            )
            .run(programId, value.academic.cohortName, now, now)
            .lastInsertRowid,
        );
      }
      const periodId = Number(
        connection.sqlite
          .prepare(
            `insert into academic_periods
             (label, starts_on, ends_on, created_at, updated_at)
             values (?, ?, ?, ?, ?)`,
          )
          .run(
            value.academic.periodLabel,
            value.academic.periodStartsOn,
            value.academic.periodEndsOn,
            now,
            now,
          ).lastInsertRowid,
      );
      const subjectId = Number(
        connection.sqlite
          .prepare(
            `insert into subjects (name, created_at, updated_at)
             values (?, ?, ?)`,
          )
          .run(value.academic.subjectName, now, now).lastInsertRowid,
      );
      const offeringId = Number(
        connection.sqlite
          .prepare(
            `insert into subject_offerings
             (subject_id, program_id, academic_period_id, status,
              created_at, updated_at)
             values (?, ?, ?, 'active', ?, ?)`,
          )
          .run(subjectId, programId, periodId, now, now).lastInsertRowid,
      );
      connection.sqlite
        .prepare(
          `insert into user_academic_memberships
           (user_id, program_id, cohort_id, updated_at)
           values (?, ?, ?, ?)`,
        )
        .run(userId, programId, cohortId, now);
      connection.sqlite
        .prepare(
          `insert into enrollments (user_id, offering_id, created_at)
           values (?, ?, ?)`,
        )
        .run(userId, offeringId, now);
      connection.sqlite
        .prepare(
          `insert into app_settings (key, value, updated_at)
           values ('academic.current_period_id', ?, ?)`,
        )
        .run(String(periodId), now);
      if (value.academic.expectedPeriods) {
        connection.sqlite
          .prepare(
            `insert into app_settings (key, value, updated_at)
             values ('academic.expected_period_count', ?, ?)`,
          )
          .run(String(value.academic.expectedPeriods), now);
      }
      connection.sqlite
        .prepare(
          `insert into storage_settings
           (id, include_cohort, patterns_json, categories_json,
            updated_by_user_id, updated_at)
           values (1, ?, ?, ?, ?, ?)`,
        )
        .run(
          Number(value.academic.includeCohortInStorage),
          JSON.stringify(defaultStorageLayout.patterns),
          JSON.stringify(defaultStorageLayout.categories),
          userId,
          now,
        );
    }

    recordAuditEvent(
      {
        actorUserId: userId,
        action: "setup.bootstrap_admin",
        targetType: "user",
        targetId: String(userId),
        summary: "first administrator created",
      },
      connection,
    );

    return {
      id: userId,
      displayName: value.displayName,
      login: value.login,
      role: "admin" as const,
    };
  });

  return bootstrap.immediate();
}

function isLoginBlocked(
  keyHash: string,
  connection: DatabaseConnection,
  now: number,
): boolean {
  const row = connection.sqlite
    .prepare(
      "select blocked_until as blockedUntil from login_rate_limits where key_hash = ?",
    )
    .get(keyHash) as { blockedUntil: number | null } | undefined;
  return row?.blockedUntil !== null && row?.blockedUntil !== undefined
    ? row.blockedUntil > now
    : false;
}

function registerLoginFailure(
  keyHash: string,
  connection: DatabaseConnection,
  now: number,
) {
  const update = connection.sqlite.transaction(() => {
    const current = connection.sqlite
      .prepare(
        `select failed_count as failedCount, window_started_at as windowStartedAt
         from login_rate_limits where key_hash = ?`,
      )
      .get(keyHash) as
      { failedCount: number; windowStartedAt: number } | undefined;

    const withinWindow =
      current !== undefined && now - current.windowStartedAt < LOGIN_WINDOW_MS;
    const failedCount = withinWindow ? current.failedCount + 1 : 1;
    const windowStartedAt = withinWindow ? current.windowStartedAt : now;
    const blockedUntil =
      failedCount >= LOGIN_FAILURE_LIMIT ? now + LOGIN_BLOCK_MS : null;

    connection.sqlite
      .prepare(
        `insert into login_rate_limits
         (key_hash, failed_count, window_started_at, blocked_until, updated_at)
         values (?, ?, ?, ?, ?)
         on conflict(key_hash) do update set
           failed_count = excluded.failed_count,
           window_started_at = excluded.window_started_at,
           blocked_until = excluded.blocked_until,
           updated_at = excluded.updated_at`,
      )
      .run(keyHash, failedCount, windowStartedAt, blockedUntil, now);
  });
  update.immediate();
}

export async function authenticateLocalUser(
  loginInput: string,
  password: string,
  connection: DatabaseConnection = getDatabase(),
  now = Date.now(),
): Promise<AuthenticatedUser | null> {
  const normalized = loginInput.trim().toLowerCase().slice(0, 120);
  const rateKey = loginRateKey(normalized);
  if (isLoginBlocked(rateKey, connection, now)) return null;

  const parsedLogin = loginSchema.safeParse(normalized);
  const user = parsedLogin.success
    ? findUserForAuthentication(parsedLogin.data, connection)
    : null;
  const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordWithinLimit = password.length <= 128;
  const validPassword = await verifyPassword(
    passwordHash,
    passwordWithinLimit ? password : "invalid-password-length-sentinel",
  );

  if (!user || !user.active || !passwordWithinLimit || !validPassword) {
    registerLoginFailure(rateKey, connection, now);
    return null;
  }

  connection.sqlite.transaction(() => {
    connection.sqlite
      .prepare("delete from login_rate_limits where key_hash = ?")
      .run(rateKey);
    connection.sqlite
      .prepare(
        "update users set last_login_at = ?, updated_at = ? where id = ?",
      )
      .run(now, now, user.id);
    recordAuditEvent(
      {
        actorUserId: user.id,
        action: "auth.login",
        targetType: "session",
        targetId: null,
        summary: "local login succeeded",
      },
      connection,
    );
  })();

  return {
    id: user.id,
    displayName: user.displayName,
    login: user.login,
    role: user.role,
  };
}

export function listUsers(
  connection: DatabaseConnection = getDatabase(),
): UserRecord[] {
  const rows = connection.sqlite
    .prepare(
      `select
         id,
         display_name as displayName,
         login,
         role,
         active,
         last_login_at as lastLoginAt,
         created_at as createdAt,
         updated_at as updatedAt
       from users
       order by active desc, role asc, display_name collate nocase, id`,
    )
    .all() as Array<Omit<UserRecord, "active"> & { active: number }>;
  return rows.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export function assertActiveAdmin(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  const row = connection.sqlite
    .prepare(
      "select 1 as allowed from users where id = ? and active = 1 and role = 'admin'",
    )
    .get(userId) as { allowed: number } | undefined;
  if (!row) throw new Error("Forbidden.");
}

function activeAdminCount(connection: DatabaseConnection): number {
  return (
    connection.sqlite
      .prepare(
        "select count(*) as count from users where role = 'admin' and active = 1",
      )
      .get() as { count: number }
  ).count;
}

export async function createMember(
  actorUserId: number,
  input: CreateMemberInput,
  connection: DatabaseConnection = getDatabase(),
): Promise<UserRecord> {
  const value = memberInputSchema.parse(input);
  const passwordHash = await hashPassword(value.password);

  const create = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const now = Date.now();
    const result = connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          notification_preferences_json, password_changed_at, created_at, updated_at)
         values (?, ?, ?, 'member', 1, ?, ?, ?, ?)`,
      )
      .run(
        value.displayName,
        value.login,
        passwordHash,
        JSON.stringify(defaultNotificationPreferences),
        now,
        now,
        now,
      );
    const userId = Number(result.lastInsertRowid);
    recordAuditEvent(
      {
        actorUserId,
        action: "user.create",
        targetType: "user",
        targetId: String(userId),
        summary: "member created",
      },
      connection,
    );
    return {
      id: userId,
      displayName: value.displayName,
      login: value.login,
      role: "member" as const,
      active: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  return create.immediate();
}

export function updateUserRole(
  actorUserId: number,
  targetUserId: number,
  roleInput: string,
  connection: DatabaseConnection = getDatabase(),
): void {
  const role = userRoleSchema.parse(roleInput);
  const update = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const target = connection.sqlite
      .prepare("select role, active from users where id = ?")
      .get(targetUserId) as
      { role: "admin" | "member"; active: boolean } | undefined;
    if (!target) throw new Error("User not found.");
    if (
      target.role === "admin" &&
      target.active &&
      role === "member" &&
      activeAdminCount(connection) <= 1
    ) {
      throw new Error("The last active administrator cannot be demoted.");
    }

    connection.sqlite
      .prepare("update users set role = ?, updated_at = ? where id = ?")
      .run(role, Date.now(), targetUserId);
    if (role === "admin") {
      connection.sqlite
        .prepare("delete from moderator_program_scopes where user_id = ?")
        .run(targetUserId);
      connection.sqlite
        .prepare("delete from curator_cohort_scopes where user_id = ?")
        .run(targetUserId);
    }
    if (role === "member") revokeUserSessions(targetUserId, connection);
    recordAuditEvent(
      {
        actorUserId,
        action: "user.role_change",
        targetType: "user",
        targetId: String(targetUserId),
        summary: `role:${target.role}->${role}`,
      },
      connection,
    );
  });
  update.immediate();
}

export function setUserActive(
  actorUserId: number,
  targetUserId: number,
  active: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const update = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const target = connection.sqlite
      .prepare("select role, active from users where id = ?")
      .get(targetUserId) as
      { role: "admin" | "member"; active: boolean } | undefined;
    if (!target) throw new Error("User not found.");
    if (
      target.role === "admin" &&
      target.active &&
      !active &&
      activeAdminCount(connection) <= 1
    ) {
      throw new Error("The last active administrator cannot be disabled.");
    }

    connection.sqlite
      .prepare("update users set active = ?, updated_at = ? where id = ?")
      .run(Number(active), Date.now(), targetUserId);
    if (!active) revokeUserSessions(targetUserId, connection);
    recordAuditEvent(
      {
        actorUserId,
        action: active ? "user.enable" : "user.disable",
        targetType: "user",
        targetId: String(targetUserId),
        summary: active ? "user enabled" : "user disabled",
      },
      connection,
    );
  });
  update.immediate();
}

export async function resetUserPassword(
  actorUserId: number,
  targetUserId: number,
  password: string,
  connection: DatabaseConnection = getDatabase(),
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const reset = connection.sqlite.transaction(() => {
    assertActiveAdmin(actorUserId, connection);
    const now = Date.now();
    const result = connection.sqlite
      .prepare(
        `update users
         set password_hash = ?, password_changed_at = ?, updated_at = ?
         where id = ?`,
      )
      .run(passwordHash, now, now, targetUserId);
    if (result.changes !== 1) throw new Error("User not found.");
    revokeUserSessions(targetUserId, connection, now);
    recordAuditEvent(
      {
        actorUserId,
        action: "user.password_reset",
        targetType: "user",
        targetId: String(targetUserId),
        summary: "local credential reset; sessions revoked",
      },
      connection,
    );
  });
  reset.immediate();
}

export const loginRateLimitPolicy = {
  failureLimit: LOGIN_FAILURE_LIMIT,
  windowMs: LOGIN_WINDOW_MS,
  blockMs: LOGIN_BLOCK_MS,
} as const;
