import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const request = vi.hoisted(() => {
  type Cookie = {
    value: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
    path: string;
  };
  const stored = new Map<string, Cookie>();
  let origin = "http://192.168.1.70:3001";
  let host = "192.168.1.70:3001";
  let forwardedProto = "http";
  return {
    stored,
    setOrigin(value: string, forwarded = new URL(value).protocol.slice(0, -1)) {
      origin = value;
      host = new URL(value).host;
      forwardedProto = forwarded;
    },
    headers: {
      get(name: string) {
        if (name === "origin") return origin;
        if (name === "host") return host;
        if (name === "x-forwarded-proto") return forwardedProto;
        return null;
      },
    },
    jar: {
      get(name: string) {
        const cookie = stored.get(name);
        if (!cookie || (cookie.secure && !origin.startsWith("https:")))
          return undefined;
        return { value: cookie.value };
      },
      set(
        name: string,
        value: string,
        options: {
          secure: boolean;
          httpOnly: boolean;
          sameSite: string;
          path: string;
          maxAge: number;
        },
      ) {
        if (options.maxAge === 0) {
          stored.delete(name);
          return;
        }
        // Browsers do not persist a Secure cookie set over a LAN HTTP origin.
        if (options.secure && !origin.startsWith("https:")) return;
        stored.set(name, { value, ...options });
      },
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => request.jar,
  headers: async () => request.headers,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { loginAction, logoutAdminAction } from "@/app/control/actions";
import { hashPassword } from "@/lib/password";
import { authenticateAdminV2, revokeAdminSessionV2 } from "./auth";
import { openV2Database, migrateV2, type V2Database } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  currentAdminV2,
  writeUserSessionV2,
  clearUserSessionV2,
  ADMIN_COOKIE,
  USER_COOKIE,
} from "./runtime";
import {
  clearV2SessionCookie,
  secureV2CookieForRequest,
  writeV2SessionCookie,
} from "./session-cookie";

let db: V2Database | undefined;
afterEach(() => {
  db?.close();
  db = undefined;
  request.stored.clear();
  vi.unstubAllEnvs();
});

describe("cookies de sessão V2 por origem", () => {
  it("faz login, navega e sai no Admin HTTP LAN com APP_URL HTTPS", async () => {
    const directory = mkdtempSync(join(tmpdir(), "osh-v2-lan-auth-"));
    const databasePath = join(directory, "v2.db");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPENSTUDYHUB_V2_ENABLED", "1");
    vi.stubEnv("OPENSTUDYHUB_V2_DATABASE_PATH", databasePath);
    vi.stubEnv("DATABASE_PATH", join(directory, "v1.db"));
    vi.stubEnv("APP_URL", "https://openstudyhub-ucsal.dev");
    request.setOrigin("http://192.168.1.70:3001");
    try {
      const connection = openV2Database(databasePath);
      migrateV2(connection);
      seedV2Fake(connection, await hashPassword("FicticioLocal!2030"));
      connection.close();

      const form = new FormData();
      form.set("login", "admin.fake");
      form.set("password", "FicticioLocal!2030");
      await expect(loginAction(form)).rejects.toThrow("REDIRECT:/control");
      expect(request.stored.get(ADMIN_COOKIE)?.secure).toBe(false);

      for (const route of [
        "/control",
        "/control/extras",
        "/control/users",
        "/control/system",
      ]) {
        const pageConnection = openV2Database(databasePath);
        expect(await currentAdminV2(pageConnection), route).toMatchObject({
          kind: "admin",
        });
        pageConnection.close();
      }

      await expect(logoutAdminAction()).rejects.toThrow(
        "REDIRECT:/control/login",
      );
      expect(request.jar.get(ADMIN_COOKIE)).toBeUndefined();
      const afterLogout = openV2Database(databasePath);
      expect(await currentAdminV2(afterLogout)).toBeNull();
      afterLogout.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("mantém o Admin autenticado nas páginas protegidas em HTTP LAN na produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    request.setOrigin("http://192.168.1.70:3001");
    db = openV2Database(":memory:");
    migrateV2(db);
    seedV2Fake(db, await hashPassword("FicticioLocal!2030"));

    const login = await authenticateAdminV2(
      db,
      "admin.fake",
      "FicticioLocal!2030",
    );
    expect(login).not.toBeNull();
    await writeV2SessionCookie(ADMIN_COOKIE, login!.token);
    expect(request.stored.get(ADMIN_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(request.stored.get(ADMIN_COOKIE)).not.toHaveProperty("domain");

    for (const route of [
      "/control",
      "/control/extras",
      "/control/users",
      "/control/system",
    ]) {
      expect(await currentAdminV2(db), route).toMatchObject({ kind: "admin" });
    }

    revokeAdminSessionV2(db, request.jar.get(ADMIN_COOKIE)?.value);
    await clearV2SessionCookie(ADMIN_COOKIE);
    expect(request.jar.get(ADMIN_COOKIE)).toBeUndefined();
    expect(await currentAdminV2(db)).toBeNull();
  });

  it("mantém Secure no App HTTPS e não enfraquece origens públicas HTTP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    request.setOrigin("https://openstudyhub-ucsal.dev");
    await writeUserSessionV2("token-ficticio");
    expect(request.stored.get(USER_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    await clearUserSessionV2();
    expect(request.jar.get(USER_COOKIE)).toBeUndefined();
    request.setOrigin("http://public.example:3000");
    expect(secureV2CookieForRequest(request.headers, true)).toBe(true);
    request.setOrigin("http://192.168.1.70:3001", "https");
    expect(secureV2CookieForRequest(request.headers, true)).toBe(true);
    expect(secureV2CookieForRequest({ get: () => null }, true)).toBe(true);
  });
});
