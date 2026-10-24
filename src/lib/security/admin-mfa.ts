import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { V2Database } from "@/lib/v2/database";
import { verifyPassword } from "@/lib/password";
import { recordAdminAction } from "@/lib/v2/audit";
import { seal, unseal } from "./secrets";

export const MFA_COOKIE = "osh_admin_mfa_challenge";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const error = () =>
  new Error(
    "Senha ou código inválido, expirado ou limite de tentativas atingido. / Invalid or expired password/code, or attempt limit reached.",
  );
export function base32(bytes: Buffer) {
  let bits = 0,
    value = 0,
    output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}
function decode32(secret: string) {
  let bits = 0,
    value = 0;
  const output: number[] = [];
  for (const ch of secret) {
    const n = alphabet.indexOf(ch);
    if (n < 0) throw error();
    value = (value << 5) | n;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
export function totp(secret: string, step = Math.floor(Date.now() / 30_000)) {
  const time = Buffer.alloc(8);
  time.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decode32(secret)).update(time).digest();
  const offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}
function matchingStep(secret: string, code: string, last: number, now: number) {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const candidate of [step, step - 1, step + 1]) {
    if (
      candidate > last &&
      timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code))
    )
      return candidate;
  }
  return null;
}
type State = {
  secret_encrypted: string | null;
  pending_encrypted: string | null;
  pending_expires_at: number | null;
  last_step: number;
  enabled_at: number | null;
};
export function mfaState(db: V2Database, id: number) {
  return db.prepare("SELECT * FROM admin_mfa WHERE admin_id=?").get(id) as
    State | undefined;
}
export function beginMfaChallenge(
  db: V2Database,
  id: number,
  passwordHash: string,
  now = Date.now(),
) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM admin_mfa_challenges WHERE expires_at<=?").run(now);
  db.prepare(
    "INSERT INTO admin_mfa_challenges(token_hash,admin_id,password_hash,expires_at) VALUES(?,?,?,?)",
  ).run(hash(token), id, passwordHash, now + 300_000);
  return { token, id, secondFactor: true as const };
}
// Failed attempts are retained across new challenges and enrollment/management calls.
function reserveAttempt(db: V2Database, id: number, now: number) {
  const key = hash(`mfa:${id}`);
  db.prepare("DELETE FROM v2_auth_attempts WHERE attempted_at<?").run(
    now - 900_000,
  );
  const n = (
    db
      .prepare(
        "SELECT count(*) n FROM v2_auth_attempts WHERE realm='admin' AND login_hash=?",
      )
      .get(key) as { n: number }
  ).n;
  if (n >= 5) return false;
  db.prepare(
    "INSERT INTO v2_auth_attempts(realm,login_hash,attempted_at) VALUES('admin',?,?)",
  ).run(key, now);
  return true;
}
function clearAttempts(db: V2Database, id: number) {
  db.prepare(
    "DELETE FROM v2_auth_attempts WHERE realm='admin' AND login_hash=?",
  ).run(hash(`mfa:${id}`));
}
function consumeFactor(db: V2Database, id: number, code: string, now: number) {
  const state = mfaState(db, id);
  if (!state?.secret_encrypted || !state.enabled_at) return false;
  const step = matchingStep(
    unseal(state.secret_encrypted, "admin-mfa"),
    code.trim(),
    state.last_step,
    now,
  );
  if (step !== null)
    return (
      db
        .prepare(
          "UPDATE admin_mfa SET last_step=? WHERE admin_id=? AND last_step<?",
        )
        .run(step, id, step).changes === 1
    );
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(normalized)) return false;
  return (
    db
      .prepare(
        "UPDATE admin_mfa_recovery SET consumed_at=? WHERE admin_id=? AND code_hash=? AND consumed_at IS NULL",
      )
      .run(now, id, hash(normalized)).changes === 1
  );
}
export function completeMfaChallenge(
  db: V2Database,
  token: string,
  code: string,
  now = Date.now(),
) {
  if (!token || token.length > 100) return null;
  return db
    .transaction(() => {
      const row = db
        .prepare(
          `SELECT c.*,a.active,a.password_hash current_password FROM admin_mfa_challenges c JOIN admin_accounts a ON a.id=c.admin_id WHERE c.token_hash=?`,
        )
        .get(hash(token)) as
        | {
            admin_id: number;
            password_hash: string;
            current_password: string;
            active: number;
            expires_at: number;
            attempts: number;
          }
        | undefined;
      if (
        !row ||
        !row.active ||
        row.password_hash !== row.current_password ||
        row.expires_at <= now ||
        row.attempts >= 5
      )
        return null;
      db.prepare(
        "UPDATE admin_mfa_challenges SET attempts=attempts+1 WHERE token_hash=?",
      ).run(hash(token));
      if (
        !reserveAttempt(db, row.admin_id, now) ||
        !consumeFactor(db, row.admin_id, code, now)
      )
        return null;
      db.prepare("DELETE FROM admin_mfa_challenges WHERE token_hash=?").run(
        hash(token),
      );
      clearAttempts(db, row.admin_id);
      const session = randomBytes(32).toString("base64url");
      db.prepare(
        "INSERT INTO admin_sessions(admin_id,token_hash,created_at,expires_at) VALUES(?,?,?,?)",
      ).run(row.admin_id, hash(session), now, now + 7 * 86400_000);
      recordAdminAction(
        db,
        { kind: "admin", id: row.admin_id },
        "mfa.login",
        "admin",
        row.admin_id,
      );
      return { token: session, id: row.admin_id };
    })
    .immediate();
}
async function reauthenticate(db: V2Database, id: number, password: string) {
  if (!db.transaction(() => reserveAttempt(db, id, Date.now())).immediate())
    throw error();
  const row = db
    .prepare("SELECT password_hash FROM admin_accounts WHERE id=? AND active=1")
    .get(id) as { password_hash: string } | undefined;
  if (!row || !(await verifyPassword(row.password_hash, password)))
    throw error();
  return row.password_hash;
}
function unchangedPassword(db: V2Database, id: number, snapshot: string) {
  if (
    !db
      .prepare(
        "SELECT 1 FROM admin_accounts WHERE id=? AND active=1 AND password_hash=?",
      )
      .get(id, snapshot)
  )
    throw error();
}
export async function startMfaEnrollment(
  db: V2Database,
  id: number,
  password: string,
) {
  const snapshot = await reauthenticate(db, id, password);
  return db
    .transaction(() => {
      unchangedPassword(db, id, snapshot);
      if (mfaState(db, id)?.enabled_at) throw error();
      const secret = base32(randomBytes(20));
      db.prepare(
        `INSERT INTO admin_mfa(admin_id,pending_encrypted,pending_expires_at) VALUES(?,?,?) ON CONFLICT(admin_id) DO UPDATE SET pending_encrypted=excluded.pending_encrypted,pending_expires_at=excluded.pending_expires_at`,
      ).run(id, seal(secret, "admin-mfa"), Date.now() + 600_000);
      const account = db
        .prepare("SELECT login FROM admin_accounts WHERE id=?")
        .get(id) as { login: string };
      clearAttempts(db, id);
      return {
        secret,
        uri: `otpauth://totp/${encodeURIComponent(`OpenStudyHub:${account.login}`)}?secret=${secret}&issuer=OpenStudyHub&algorithm=SHA1&digits=6&period=30`,
      };
    })
    .immediate();
}
function recoveryCodes(db: V2Database, id: number) {
  db.prepare("DELETE FROM admin_mfa_recovery WHERE admin_id=?").run(id);
  const codes = Array.from({ length: 10 }, () =>
    randomBytes(16).toString("hex").toUpperCase(),
  );
  for (const code of codes)
    db.prepare(
      "INSERT INTO admin_mfa_recovery(admin_id,code_hash) VALUES(?,?)",
    ).run(id, hash(code));
  return codes.map((code) => code.match(/.{1,8}/g)!.join("-"));
}
function revokeOthers(db: V2Database, id: number, token: string) {
  db.prepare(
    "UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND token_hash<>? AND revoked_at IS NULL",
  ).run(Date.now(), id, hash(token));
  db.prepare("DELETE FROM admin_mfa_challenges WHERE admin_id=?").run(id);
}
export async function manageMfa(
  db: V2Database,
  id: number,
  password: string,
  code: string,
  action: "enable" | "disable" | "regenerate",
  currentSession: string,
) {
  const snapshot = await reauthenticate(db, id, password);
  // Commit invalid attempts too: never throw inside the verification transaction.
  const result = db
    .transaction(() => {
      unchangedPassword(db, id, snapshot);
      if (action === "enable") {
        const state = mfaState(db, id);
        if (
          state?.enabled_at ||
          !state?.pending_encrypted ||
          !state.pending_expires_at ||
          state.pending_expires_at <= Date.now()
        )
          return null;
        const step = matchingStep(
          unseal(state.pending_encrypted, "admin-mfa"),
          code.trim(),
          -1,
          Date.now(),
        );
        if (step === null) return null;
        db.prepare(
          "UPDATE admin_mfa SET secret_encrypted=pending_encrypted,pending_encrypted=NULL,pending_expires_at=NULL,enabled_at=?,last_step=? WHERE admin_id=?",
        ).run(Date.now(), step, id);
      } else if (!consumeFactor(db, id, code, Date.now())) return null;
      const codes = action === "disable" ? [] : recoveryCodes(db, id);
      if (action === "disable") {
        db.prepare("DELETE FROM admin_mfa WHERE admin_id=?").run(id);
        db.prepare("DELETE FROM admin_mfa_recovery WHERE admin_id=?").run(id);
      }
      revokeOthers(db, id, currentSession);
      clearAttempts(db, id);
      recordAdminAction(
        db,
        { kind: "admin", id },
        `mfa.${action}`,
        "admin",
        id,
      );
      return { codes };
    })
    .immediate();
  if (!result) throw error();
  return result;
}
export function operatorResetMfa(db: V2Database, login: string) {
  return db
    .transaction(() => {
      const admin = db
        .prepare("SELECT id FROM admin_accounts WHERE login=? AND active=1")
        .get(login) as { id: number } | undefined;
      if (!admin) throw new Error("Admin not found.");
      db.prepare("DELETE FROM admin_mfa WHERE admin_id=?").run(admin.id);
      db.prepare("DELETE FROM admin_mfa_recovery WHERE admin_id=?").run(
        admin.id,
      );
      db.prepare("DELETE FROM admin_mfa_challenges WHERE admin_id=?").run(
        admin.id,
      );
      db.prepare(
        "UPDATE admin_sessions SET revoked_at=? WHERE admin_id=? AND revoked_at IS NULL",
      ).run(Date.now(), admin.id);
      clearAttempts(db, admin.id);
      recordAdminAction(
        db,
        { kind: "admin", id: admin.id },
        "mfa.operator_reset",
        "admin",
        admin.id,
      );
    })
    .immediate();
}
