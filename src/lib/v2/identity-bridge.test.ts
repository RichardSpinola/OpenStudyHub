import { describe, expect, it } from "vitest";
import { createMigratedTestDatabase } from "@/lib/test-database";
import { hashPassword } from "@/lib/password";
import { openV2Database, migrateV2 } from "./database";
import {
  authenticateNormal,
  canonicalIdForLegacy,
  projectLegacySession,
} from "./identity-bridge";
import {
  authenticateAdminV2,
  revokeAdminSessionV2,
  revokeUserSessionV2,
  sessionAdminV2,
  sessionUserV2,
} from "./auth";
import { seedV2Fake } from "./fixtures";
import { visiblePrograms } from "./control";
import { getUserProfile } from "@/lib/profile";
import { updateUiLanguage } from "@/lib/ui-language";

describe("normal identity bridge", () => {
  it("uses a V2 session and an explicit legacy mapping even when numeric IDs differ", async () => {
    const v1 = createMigratedTestDatabase();
    const v2 = openV2Database(":memory:");
    try {
      migrateV2(v2);
      updateUiLanguage("en", v1);
      const hash = await hashPassword("FicticioLocal!2030");
      v1.sqlite
        .prepare(
          "INSERT INTO users(id,display_name,login,password_hash,role) VALUES(2,'Unrelated','other.fake',?,'member')",
        )
        .run(hash);
      v2.prepare(
        "INSERT INTO users(id,login,display_name,password_hash) VALUES(2,'student.fake','Student',?)",
      ).run(hash);
      const session = await authenticateNormal(
        v2,
        "student.fake",
        "FicticioLocal!2030",
        v1,
      );
      expect(session?.id).toBe(2);
      const projected = projectLegacySession(v2, session?.token, v1);
      expect(projected?.user.id).not.toBe(2);
      expect(projected?.expiresAt).toBeGreaterThan(Date.now());
      expect(canonicalIdForLegacy(v2, projected!.user.id)).toBe(2);
      expect(getUserProfile(projected!.user.id, v1).locale).toBe("en");
      expect(projectLegacySession(v2, "invalid", v1)).toBeNull();
    } finally {
      v2.close();
      v1.close();
    }
  });

  it("imports only a password-proven V1 member, never a legacy admin or colliding account", async () => {
    const v1 = createMigratedTestDatabase();
    const v2 = openV2Database(":memory:");
    try {
      migrateV2(v2);
      const hash = await hashPassword("FicticioLocal!2030");
      v1.sqlite
        .prepare(
          "INSERT INTO users(display_name,login,password_hash,role) VALUES('Member','member.fake',?,'member'),('Admin','admin.fake',?,'admin')",
        )
        .run(hash, hash);
      expect(
        await authenticateNormal(v2, "admin.fake", "FicticioLocal!2030", v1),
      ).toBeNull();
      const imported = await authenticateNormal(
        v2,
        "member.fake",
        "FicticioLocal!2030",
        v1,
      );
      expect(imported).not.toBeNull();
      expect(projectLegacySession(v2, imported?.token, v1)?.user.role).toBe(
        "member",
      );
      v2.prepare(
        "INSERT INTO users(login,display_name,password_hash) VALUES('collision.fake','Other',?)",
      ).run(hash);
      v1.sqlite
        .prepare(
          "INSERT INTO users(display_name,login,password_hash,role) VALUES('Different','collision.fake',?,'member')",
        )
        .run(await hashPassword("Different!2030"));
      await expect(
        authenticateNormal(v2, "collision.fake", "FicticioLocal!2030", v1),
      ).rejects.toThrow("revisão");
    } finally {
      v2.close();
      v1.close();
    }
  });

  it("uses the same normal session for legacy projection and scoped management, independently of Admin", async () => {
    const v1 = createMigratedTestDatabase();
    const v2 = openV2Database(":memory:");
    try {
      migrateV2(v2);
      seedV2Fake(v2, await hashPassword("FicticioLocal!2030"));
      const normal = await authenticateNormal(
        v2,
        "manager.fake",
        "FicticioLocal!2030",
        v1,
      );
      const admin = await authenticateAdminV2(
        v2,
        "admin.fake",
        "FicticioLocal!2030",
      );
      expect(normal).not.toBeNull();
      expect(admin).not.toBeNull();
      expect(projectLegacySession(v2, normal?.token, v1)?.user.role).toBe(
        "member",
      );
      const manager = sessionUserV2(v2, normal?.token);
      expect(manager?.kind).toBe("user");
      expect(visiblePrograms(v2, manager!)).toHaveLength(1);
      expect(sessionAdminV2(v2, normal?.token)).toBeNull();
      expect(sessionUserV2(v2, admin?.token)).toBeNull();
      revokeUserSessionV2(v2, normal?.token);
      expect(projectLegacySession(v2, normal?.token, v1)).toBeNull();
      expect(sessionAdminV2(v2, admin?.token)?.kind).toBe("admin");
      revokeAdminSessionV2(v2, admin?.token);
      expect(sessionAdminV2(v2, admin?.token)).toBeNull();
    } finally {
      v2.close();
      v1.close();
    }
  });

  it("rejects disabled and temporary users from the daily projection", async () => {
    const v1 = createMigratedTestDatabase();
    const v2 = openV2Database(":memory:");
    try {
      migrateV2(v2);
      const hash = await hashPassword("FicticioLocal!2030");
      v2.prepare(
        "INSERT INTO users(login,display_name,password_hash,must_change_password) VALUES('temp.fake','Temp',?,1)",
      ).run(hash);
      const login = await authenticateNormal(
        v2,
        "temp.fake",
        "FicticioLocal!2030",
        v1,
      );
      expect(sessionUserV2(v2, login?.token)?.mustChangePassword).toBe(true);
      expect(projectLegacySession(v2, login?.token, v1)).toBeNull();
      v2.prepare(
        "UPDATE users SET must_change_password=0 WHERE login='temp.fake'",
      ).run();
      expect(projectLegacySession(v2, login?.token, v1)).not.toBeNull();
      v2.prepare("UPDATE users SET active=0 WHERE login='temp.fake'").run();
      expect(sessionUserV2(v2, login?.token)).toBeNull();
      expect(projectLegacySession(v2, login?.token, v1)).toBeNull();
    } finally {
      v2.close();
      v1.close();
    }
  });
});
