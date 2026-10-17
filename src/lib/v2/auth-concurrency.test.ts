import { expect, it, vi } from "vitest";
import { migrateV2, openV2Database } from "./database";
const password = vi.hoisted(() => ({ verify: vi.fn(), dummy: vi.fn() }));
vi.mock("../password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: password.verify,
  getDummyPasswordHash: password.dummy,
}));
import { authenticateUserV2 } from "./auth";

it("reserves failed login attempts before verification so a parallel burst cannot bypass the account limit", async () => {
  const db = openV2Database(":memory:");
  migrateV2(db);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  password.dummy.mockResolvedValue("dummy");
  password.verify.mockImplementation(async () => {
    await gate;
    return false;
  });
  try {
    const requests = Array.from({ length: 12 }, () =>
      authenticateUserV2(db, "missing.fake", "wrong"),
    );
    expect(db.prepare("SELECT count(*) n FROM v2_auth_attempts").get()).toEqual(
      { n: 5 },
    );
    release();
    expect(await Promise.all(requests)).toEqual(Array(12).fill(null));
    expect(password.verify).toHaveBeenCalledTimes(5);
    await authenticateUserV2(db, "missing.fake", "wrong");
    expect(password.verify).toHaveBeenCalledTimes(5);
    db.prepare("UPDATE v2_auth_attempts SET attempted_at=0").run();
    await authenticateUserV2(db, "missing.fake", "wrong");
    expect(password.verify).toHaveBeenCalledTimes(6);
  } finally {
    db.close();
  }
});
