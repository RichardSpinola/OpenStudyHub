import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { openV2Database, migrateV2, type V2Database } from "../v2/database";
import { authenticateAdminV2, sessionAdminV2 } from "../v2/auth";
import {
  base32,
  totp,
  startMfaEnrollment,
  manageMfa,
  completeMfaChallenge,
  operatorResetMfa,
} from "./admin-mfa";
vi.mock("../password", () => ({
  verifyPassword: async (hash: string, password: string) => hash === password,
  getDummyPasswordHash: async () => "dummy",
  hashPassword: async (s: string) => s,
}));
let db: V2Database;
beforeEach(() => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  db = openV2Database(":memory:");
  migrateV2(db);
  db.prepare(
    "INSERT INTO admin_accounts(id,login,display_name,password_hash) VALUES(1,'admin','Admin','correct-password')",
  ).run();
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
});
async function enroll() {
  const setup = await startMfaEnrollment(db, 1, "correct-password");
  const result = await manageMfa(
    db,
    1,
    "correct-password",
    totp(setup.secret),
    "enable",
    "current-session",
  );
  return { ...setup, ...result };
}
it("matches RFC 6238 six-digit SHA-1 vectors", () => {
  const secret = base32(Buffer.from("12345678901234567890"));
  expect(totp(secret, 1)).toBe("287082");
  expect(totp(secret, Math.floor(1111111109000 / 30000))).toBe("081804");
});
it("keeps existing accounts compatible and creates no complete session before MFA", async () => {
  const session = await authenticateAdminV2(db, "admin", "correct-password");
  expect(sessionAdminV2(db, session!.token)?.id).toBe(1);
  const { secret, codes } = await enroll();
  expect(codes).toHaveLength(10);
  const challenge = await authenticateAdminV2(db, "admin", "correct-password");
  expect(challenge?.secondFactor).toBe(true);
  expect(sessionAdminV2(db, challenge!.token)).toBeNull();
  expect(completeMfaChallenge(db, challenge!.token, totp(secret))).toBeNull(); // enrollment consumed this time step
  const result = completeMfaChallenge(
    db,
    challenge!.token,
    totp(secret, Math.floor(Date.now() / 30000) + 1),
  );
  expect(sessionAdminV2(db, result!.token)?.id).toBe(1);
  expect(completeMfaChallenge(db, challenge!.token, codes[0])).toBeNull();
});
it("checks passwords and confirmation codes; stores only encrypted secrets and recovery hashes", async () => {
  await expect(startMfaEnrollment(db, 1, "wrong")).rejects.toThrow();
  const setup = await startMfaEnrollment(db, 1, "correct-password");
  await expect(
    manageMfa(db, 1, "correct-password", "invalid", "enable", ""),
  ).rejects.toThrow();
  const { codes } = await manageMfa(
    db,
    1,
    "correct-password",
    totp(setup.secret),
    "enable",
    "",
  );
  expect(
    JSON.stringify(db.prepare("SELECT * FROM admin_mfa").all()),
  ).not.toContain(setup.secret);
  expect(
    JSON.stringify(db.prepare("SELECT * FROM admin_mfa_recovery").all()),
  ).not.toContain(codes[0].replaceAll("-", ""));
});
it("consumes a recovery code atomically across competing challenges", async () => {
  const { codes } = await enroll();
  const a = await authenticateAdminV2(db, "admin", "correct-password");
  const b = await authenticateAdminV2(db, "admin", "correct-password");
  const results = await Promise.all([
    Promise.resolve().then(() => completeMfaChallenge(db, a!.token, codes[0])),
    Promise.resolve().then(() => completeMfaChallenge(db, b!.token, codes[0])),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
});
it("rejects expiry, fifth failed attempt, cross-challenge brute force, and expired enrollment", async () => {
  const { codes } = await enroll();
  const a = await authenticateAdminV2(db, "admin", "correct-password");
  expect(
    completeMfaChallenge(db, a!.token, codes[0], Date.now() + 300001),
  ).toBeNull();
  for (let i = 0; i < 5; i++)
    expect(completeMfaChallenge(db, a!.token, "invalid")).toBeNull();
  expect(completeMfaChallenge(db, a!.token, codes[0])).toBeNull();
  const b = await authenticateAdminV2(db, "admin", "correct-password");
  expect(completeMfaChallenge(db, b!.token, codes[0])).toBeNull();
  operatorResetMfa(db, "admin");
  const setup = await startMfaEnrollment(db, 1, "correct-password");
  db.prepare("UPDATE admin_mfa SET pending_expires_at=0").run();
  await expect(
    manageMfa(db, 1, "correct-password", totp(setup.secret), "enable", ""),
  ).rejects.toThrow();
});
it("regenerates/turns off only after both factors, revokes other sessions and audits operator recovery", async () => {
  const { codes } = await enroll();
  const login = await authenticateAdminV2(db, "admin", "correct-password");
  const session = completeMfaChallenge(db, login!.token, codes[0])!;
  await expect(
    manageMfa(db, 1, "wrong", codes[1], "disable", session.token),
  ).rejects.toThrow();
  const next = await manageMfa(
    db,
    1,
    "correct-password",
    codes[1],
    "regenerate",
    session.token,
  );
  expect(next.codes).toHaveLength(10);
  const second = await authenticateAdminV2(db, "admin", "correct-password");
  expect(completeMfaChallenge(db, second!.token, codes[2])).toBeNull();
  await manageMfa(
    db,
    1,
    "correct-password",
    next.codes[0],
    "disable",
    session.token,
  );
  expect(
    (await authenticateAdminV2(db, "admin", "correct-password"))?.secondFactor,
  ).toBeUndefined();
  operatorResetMfa(db, "admin");
  expect(sessionAdminV2(db, session.token)).toBeNull();
  expect(
    db
      .prepare(
        "SELECT action FROM admin_audit_events WHERE action='mfa.operator_reset'",
      )
      .get(),
  ).toBeTruthy();
});

it("accepts a TOTP time step only once across concurrent challenges", async () => {
  const { secret } = await enroll();
  const a = await authenticateAdminV2(db, "admin", "correct-password");
  const b = await authenticateAdminV2(db, "admin", "correct-password");
  const code = totp(secret, Math.floor(Date.now() / 30000) + 1);
  const results = await Promise.all(
    [a!, b!].map((challenge) =>
      Promise.resolve().then(() =>
        completeMfaChallenge(db, challenge.token, code),
      ),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(db.prepare("SELECT count(*) n FROM admin_sessions").get()).toEqual({
    n: 1,
  });
});
