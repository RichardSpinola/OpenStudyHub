import { createHash, randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  getDummyPasswordHash,
} from "../password";
import type { V2Database } from "./database";
import type { Actor } from "./actor";
import { isAdmin } from "./access";
import { recordAdminAction } from "./audit";

const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export async function bootstrapV2(
  db: V2Database,
  input: {
    login: string;
    name: string;
    password: string;
    institution: string;
    program: string;
    code: string;
    shift: string;
    cohort: string;
    period: string;
    startsOn: string;
    endsOn: string;
    semesters: number;
    subject?: string;
    instructor?: string;
    location?: string;
  },
): Promise<number> {
  if (
    !/^[a-z0-9._-]{3,64}$/i.test(input.login) ||
    input.name.trim().length < 2 ||
    input.password.length < 12
  )
    throw new Error(
      "Identidade administrativa inválida; use uma senha de pelo menos 12 caracteres.",
    );
  if (
    !input.institution.trim() ||
    !input.program.trim() ||
    !input.code.trim() ||
    !input.shift.trim() ||
    !input.cohort.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn) ||
    input.startsOn > input.endsOn ||
    input.semesters < 1 ||
    input.semesters > 20
  )
    throw new Error("Confira os dados da estrutura acadêmica.");
  const passwordHash = await hashPassword(input.password);
  return db.transaction(() => {
    if (
      (
        db.prepare("SELECT count(*) n FROM admin_accounts").get() as {
          n: number;
        }
      ).n
    )
      throw new Error("O setup inicial já foi concluído.");
    const adminId = Number(
      db
        .prepare(
          "INSERT INTO admin_accounts(login,display_name,password_hash) VALUES(?,?,?)",
        )
        .run(input.login.trim(), input.name.trim(), passwordHash)
        .lastInsertRowid,
    );
    const institutionId = Number(
      db
        .prepare("INSERT INTO institutions(name) VALUES(?)")
        .run(input.institution.trim()).lastInsertRowid,
    );
    const programId = Number(
      db
        .prepare("INSERT INTO programs(institution_id,code,name) VALUES(?,?,?)")
        .run(institutionId, input.code.trim(), input.program.trim())
        .lastInsertRowid,
    );
    const shiftId = Number(
      db
        .prepare("INSERT INTO shifts(institution_id,code,name) VALUES(?,?,?)")
        .run(institutionId, "initial", input.shift.trim()).lastInsertRowid,
    );
    const curriculumId = Number(
      db
        .prepare("INSERT INTO curricula(program_id,version) VALUES(?,?)")
        .run(programId, "initial").lastInsertRowid,
    );
    for (let ordinal = 1; ordinal <= input.semesters; ordinal++)
      db.prepare(
        "INSERT INTO curriculum_semesters(curriculum_id,ordinal) VALUES(?,?)",
      ).run(curriculumId, ordinal);
    const cohortId = Number(
      db
        .prepare(
          "INSERT INTO cohorts(program_id,curriculum_id,shift_id,code,name) VALUES(?,?,?,?,?)",
        )
        .run(programId, curriculumId, shiftId, "initial", input.cohort.trim())
        .lastInsertRowid,
    );
    const periodId = Number(
      db
        .prepare(
          "INSERT INTO academic_periods(institution_id,label,starts_on,ends_on) VALUES(?,?,?,?)",
        )
        .run(institutionId, input.period.trim(), input.startsOn, input.endsOn)
        .lastInsertRowid,
    );
    const semesterId = (
      db
        .prepare(
          "SELECT id FROM curriculum_semesters WHERE curriculum_id=? AND ordinal=1",
        )
        .get(curriculumId) as { id: number }
    ).id;
    db.prepare(
      "INSERT INTO cohort_periods(cohort_id,period_id,semester_id,state,activated_at) VALUES(?,?,?,'active',?)",
    ).run(cohortId, periodId, semesterId, Date.now());
    let instructorId: number | null = null;
    if (input.instructor?.trim())
      instructorId = Number(
        db
          .prepare("INSERT INTO instructors(institution_id,name) VALUES(?,?)")
          .run(institutionId, input.instructor.trim()).lastInsertRowid,
      );
    if (input.location?.trim())
      db.prepare("INSERT INTO locations(institution_id,name) VALUES(?,?)").run(
        institutionId,
        input.location.trim(),
      );
    if (input.subject?.trim()) {
      const subjectId = Number(
        db
          .prepare("INSERT INTO subjects(institution_id,name) VALUES(?,?)")
          .run(institutionId, input.subject.trim()).lastInsertRowid,
      );
      const mappingId = Number(
        db
          .prepare(
            "INSERT INTO curriculum_subjects(semester_id,subject_id) VALUES(?,?)",
          )
          .run(semesterId, subjectId).lastInsertRowid,
      );
      const offeringId = Number(
        db
          .prepare(
            "INSERT INTO offerings(subject_id,program_id,period_id,shift_id,instructor_id,curriculum_subject_id,state) VALUES(?,?,?,?,?,?,'active')",
          )
          .run(subjectId, programId, periodId, shiftId, instructorId, mappingId)
          .lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO offering_cohorts(offering_id,cohort_id) VALUES(?,?)",
      ).run(offeringId, cohortId);
    }
    db.prepare(
      "INSERT INTO storage_backends(kind,name,state) VALUES('local','Local','ready')",
    ).run();
    recordAdminAction(
      db,
      { kind: "admin", id: adminId },
      "setup.complete",
      "institution",
      institutionId,
    );
    return adminId;
  })();
}

type Realm = "admin" | "user";
type SessionPrincipal = Actor & { name: string; mustChangePassword: boolean };

async function authenticateRealm(
  db: V2Database,
  realm: Realm,
  login: string,
  password: string,
): Promise<{ token: string; id: number } | null> {
  const normalized = login.trim().toLowerCase();
  const loginHash = digest(normalized);
  const cutoff = Date.now() - 15 * 60_000;
  db.prepare("DELETE FROM v2_auth_attempts WHERE attempted_at<?").run(cutoff);
  const attempts = db
    .prepare(
      "SELECT count(*) n FROM v2_auth_attempts WHERE realm=? AND login_hash=? AND attempted_at>=?",
    )
    .get(realm, loginHash, cutoff) as { n: number };
  if (attempts.n >= 5) return null;
  const table = realm === "admin" ? "admin_accounts" : "users";
  const row = db
    .prepare(
      `SELECT id,password_hash,active FROM ${table} WHERE lower(login)=?`,
    )
    .get(normalized) as
    { id: number; password_hash: string; active: number } | undefined;
  const valid = await verifyPassword(
    row?.password_hash ?? (await getDummyPasswordHash()),
    password,
  );
  if (!row || !row.active || !valid) {
    db.prepare(
      "INSERT INTO v2_auth_attempts(realm,login_hash,attempted_at) VALUES(?,?,?)",
    ).run(realm, loginHash, Date.now());
    return null;
  }
  db.prepare("DELETE FROM v2_auth_attempts WHERE realm=? AND login_hash=?").run(
    realm,
    loginHash,
  );
  const token = randomBytes(32).toString("base64url");
  const sessionTable = realm === "admin" ? "admin_sessions" : "user_sessions";
  const idColumn = realm === "admin" ? "admin_id" : "user_id";
  db.prepare(
    `INSERT INTO ${sessionTable}(${idColumn},token_hash,created_at,expires_at) VALUES(?,?,?,?)`,
  ).run(row.id, digest(token), Date.now(), Date.now() + SESSION_LIFETIME);
  return { token, id: row.id };
}

export const authenticateAdminV2 = (
  db: V2Database,
  login: string,
  password: string,
) => authenticateRealm(db, "admin", login, password);
export const authenticateUserV2 = (
  db: V2Database,
  login: string,
  password: string,
) => authenticateRealm(db, "user", login, password);

function sessionPrincipal(
  db: V2Database,
  realm: Realm,
  token: string | undefined,
): SessionPrincipal | null {
  if (!token || token.length > 100) return null;
  const table = realm === "admin" ? "admin_accounts" : "users";
  const sessions = realm === "admin" ? "admin_sessions" : "user_sessions";
  const column = realm === "admin" ? "admin_id" : "user_id";
  const row = db
    .prepare(
      `SELECT a.id,a.display_name name,a.must_change_password mustChangePassword FROM ${sessions} s JOIN ${table} a ON a.id=s.${column} WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND a.active=1`,
    )
    .get(digest(token), Date.now()) as
    { id: number; name: string; mustChangePassword: number } | undefined;
  return row
    ? {
        kind: realm,
        id: row.id,
        name: row.name,
        mustChangePassword: !!row.mustChangePassword,
      }
    : null;
}
export const sessionAdminV2 = (db: V2Database, token: string | undefined) =>
  sessionPrincipal(db, "admin", token);
export const sessionUserV2 = (db: V2Database, token: string | undefined) =>
  sessionPrincipal(db, "user", token);

function revokeRealmSession(
  db: V2Database,
  realm: Realm,
  token: string | undefined,
): void {
  if (!token) return;
  const table = realm === "admin" ? "admin_sessions" : "user_sessions";
  db.prepare(
    `UPDATE ${table} SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL`,
  ).run(Date.now(), digest(token));
}
export const revokeAdminSessionV2 = (
  db: V2Database,
  token: string | undefined,
) => revokeRealmSession(db, "admin", token);
export const revokeUserSessionV2 = (
  db: V2Database,
  token: string | undefined,
) => revokeRealmSession(db, "user", token);

export async function setPasswordV2(
  db: V2Database,
  actor: Actor,
  userId: number,
  newPassword: string,
  temporary: boolean,
): Promise<void> {
  if (!isAdmin(db, actor) && !(actor.kind === "user" && actor.id === userId))
    throw new Error("Sem permissão.");
  if (newPassword.length < 12)
    throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  const hash = await hashPassword(newPassword);
  db.transaction(() => {
    if (
      db
        .prepare(
          "UPDATE users SET password_hash=?,must_change_password=? WHERE id=? AND active=1",
        )
        .run(hash, temporary ? 1 : 0, userId).changes !== 1
    )
      throw new Error("Usuário indisponível.");
    db.prepare(
      "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
    ).run(Date.now(), userId);
    recordAdminAction(db, actor, "user.password_reset", "user", userId);
  })();
}

export async function setAdminPasswordV2(
  db: V2Database,
  actor: Actor,
  newPassword: string,
): Promise<void> {
  if (!isAdmin(db, actor)) throw new Error("Admin required");
  if (newPassword.length < 12)
    throw new Error("A senha precisa ter pelo menos 12 caracteres.");
  const hash = await hashPassword(newPassword);
  db.transaction(() => {
    db.prepare(
      "UPDATE admin_accounts SET password_hash=?,must_change_password=0 WHERE id=? AND active=1",
    ).run(hash, actor.id);
    db.prepare(
      "UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND revoked_at IS NULL",
    ).run(Date.now(), actor.id);
    recordAdminAction(
      db,
      actor,
      "admin.password_change",
      "admin_account",
      actor.id,
    );
  })();
}
export function isSetupPending(db: V2Database): boolean {
  return !db.prepare("SELECT 1 FROM admin_accounts LIMIT 1").get();
}
