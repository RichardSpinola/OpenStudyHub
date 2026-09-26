import { describe, expect, it } from "vitest";
import { openV2Database, migrateV2 } from "./database";
import { seedV2Fake } from "./fixtures";
import {
  inspectGoogleV2Config,
  CLASSROOM_SCOPES,
  DRIVE_SCOPE,
  type GoogleV2Config,
} from "./google-config";
import {
  startGoogleV2,
  completeGoogleV2,
  googleAccessTokenV2,
  disconnectGoogleV2,
  googleConnectionStatus,
} from "./google-oauth";
import {
  classroomCache,
  confirmClassrooms,
  parseClassroomAssignments,
  discoverClassrooms,
  suggestClassrooms,
  syncClassroom,
  GoogleClassroomAdapter,
  type ClassroomAdapter,
} from "./classroom";
import {
  GoogleDriveStorageProvider,
  setStorageOwner,
  storageOwnerStatus,
} from "./drive-storage";
import { adminActor, userActor } from "./actor";
import {
  LocalStorageProvider,
  StorageRegistry,
  storeObject,
  readObject,
} from "./storage";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const config: GoogleV2Config = {
  clientId: "fake-client",
  clientSecret: "fake-secret",
  redirectUri: "https://fake.example/api/v2/google/callback",
  encryptionKey: Buffer.alloc(32, 7),
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
function fixture() {
  const db = openV2Database(":memory:");
  migrateV2(db);
  seedV2Fake(db);
  return db;
}
function connected(db: ReturnType<typeof fixture>, userId = 3, drive = false) {
  db.prepare(
    `INSERT INTO google_connections_v2(user_id,google_subject,encrypted_refresh_token,scopes,status,updated_at)
     VALUES(?,?,? ,?,'connected',?)`,
  ).run(
    userId,
    `fake-sub-${userId}`,
    "encrypted-fake",
    [...CLASSROOM_SCOPES, ...(drive ? [DRIVE_SCOPE] : [])].join(" "),
    Date.now(),
  );
}

describe("Google V2 isolated boundaries", () => {
  it("identifica somente a permissão Classroom ausente no diagnóstico", async () => {
    const db = fixture();
    try {
      const state = new URL(
        startGoogleV2(db, 3, false, { config }),
      ).searchParams.get("state")!;
      let missing: string[] = [];
      await expect(
        completeGoogleV2(db, 3, "fake-code", state, {
          config,
          fetchImpl: (async (input: string | URL | Request) =>
            String(input).includes("userinfo")
              ? json({ sub: "fake-sub", email: "fake@example.invalid" })
              : json({
                  access_token: "access-fake",
                  refresh_token: "refresh-fake",
                  scope: CLASSROOM_SCOPES.filter(
                    (scope) => !scope.includes("courseworkmaterials"),
                  ).join(" "),
                })) as typeof fetch,
          onMissingClassroomScopes: (names) => {
            missing = names;
          },
        }),
      ).rejects.toThrow("Permissões Classroom insuficientes.");
      expect(missing).toEqual(["materiais"]);
      expect(googleConnectionStatus(db, 3)).toBeUndefined();
    } finally {
      db.close();
    }
  });
  it("requires a coherent canonical URL, HTTPS and matching callback", () => {
    const env = {
      NODE_ENV: "production" as const,
      APP_NAME: "OpenStudyHub",
      APP_URL: "https://hub.example/",
      DATABASE_PATH: ":memory:",
      PRIVATE_ASSET_PATH: "/tmp/fake",
      GOOGLE_CLIENT_ID: "fake-client",
      GOOGLE_CLIENT_SECRET: "fake-secret",
      GOOGLE_REDIRECT_URI: "https://hub.example/api/v2/google/callback",
      GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      CLASSROOM_SYNC_TTL_MINUTES: 15,
    };
    expect(inspectGoogleV2Config(env, true).config).not.toBeNull();
    expect(
      inspectGoogleV2Config({ ...env, APP_URL: "http://hub.example/" }, true)
        .diagnostic.errors,
    ).toContain("APP_URL precisa usar HTTPS fora do ambiente local.");
    expect(
      inspectGoogleV2Config(
        {
          ...env,
          GOOGLE_REDIRECT_URI: "http://localhost:3000/api/v2/google/callback",
        },
        true,
      ).config,
    ).toBeNull();
    expect(inspectGoogleV2Config(env, false).config).toBeNull();
  });
  it("binds state to user, consumes once, encrypts refresh and revokes safely", async () => {
    const db = fixture();
    try {
      const url = new URL(startGoogleV2(db, 3, true, { config, now: 1000 }));
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("scope")).toContain(DRIVE_SCOPE);
      const state = url.searchParams.get("state")!;
      const fakeFetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const target = String(input);
        if (
          target.includes("/token") &&
          String(init?.body).includes("authorization_code")
        )
          return json({
            access_token: "access-fake",
            refresh_token: "refresh-fake",
            scope: [...CLASSROOM_SCOPES, DRIVE_SCOPE].join(" "),
          });
        if (target.includes("userinfo"))
          return json({ sub: "user-3", email: "fake@example.invalid" });
        if (target.includes("/token"))
          return json({ access_token: "access-after-refresh" });
        if (target.includes("/revoke")) return json({});
        throw new Error("Unexpected fake request");
      };
      await expect(
        completeGoogleV2(db, 2, "code", state, {
          config,
          fetchImpl: fakeFetch as typeof fetch,
          now: 1001,
        }),
      ).rejects.toThrow("Estado");
      await completeGoogleV2(db, 3, "code", state, {
        config,
        fetchImpl: fakeFetch as typeof fetch,
        now: 1001,
      });
      await expect(
        completeGoogleV2(db, 3, "code", state, {
          config,
          fetchImpl: fakeFetch as typeof fetch,
          now: 1002,
        }),
      ).rejects.toThrow("Estado");
      const stored = db
        .prepare(
          "SELECT encrypted_refresh_token token FROM google_connections_v2 WHERE user_id=3",
        )
        .get() as { token: string };
      expect(stored.token).not.toContain("refresh-fake");
      expect(
        await googleAccessTokenV2(db, 3, {
          config,
          fetchImpl: fakeFetch as typeof fetch,
        }),
      ).toBe("access-after-refresh");
      await disconnectGoogleV2(db, 3, {
        config,
        fetchImpl: fakeFetch as typeof fetch,
      });
      expect(googleConnectionStatus(db, 3)).toBeUndefined();
    } finally {
      db.close();
    }
  });
  it("marks invalid_grant for reconnect without clearing independent mappings or cache", async () => {
    const db = fixture();
    try {
      const { encryptSecret } = await import("@/lib/google/crypto");
      connected(db);
      db.prepare(
        "UPDATE google_connections_v2 SET encrypted_refresh_token=? WHERE user_id=3",
      ).run(encryptSecret("refresh-fake", config.encryptionKey));
      const failure = async () => json({ error: "invalid_grant" }, 400);
      await expect(
        googleAccessTokenV2(db, 3, {
          config,
          fetchImpl: failure as typeof fetch,
        }),
      ).rejects.toThrow("Reconecte");
      expect(googleConnectionStatus(db, 3)?.status).toBe("needs_reconnect");
    } finally {
      db.close();
    }
  });
  it("suggests only personal courses, requires explicit bulk confirmation and keeps stale cache on failure", async () => {
    const db = fixture();
    try {
      connected(db);
      const adapter: ClassroomAdapter = {
        listCourses: async () => [
          { id: "a", name: "Fundamentos Fictícios" },
          { id: "b", name: "Prática Fictícia" },
          { id: "c", name: "Fundamentos Fictícios" },
        ],
        listFeed: async () => [
          {
            id: "1",
            title: "Atividade fake",
            link: "https://classroom.google.com/fake",
          },
        ],
      };
      await discoverClassrooms(db, 3, adapter);
      const suggestions = suggestClassrooms(db, 3);
      expect(suggestions.some((item) => item.ambiguous)).toBe(true);
      expect(
        db.prepare("SELECT count(*) n FROM user_classroom_mappings").get(),
      ).toEqual({ n: 0 });
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "a" }]);
      expect(() =>
        confirmClassrooms(db, 2, [{ offeringId: 1, courseId: "a" }]),
      ).toThrow();
      expect(await syncClassroom(db, 3, 1, adapter, false, 1000)).toBe(
        "updated",
      );
      expect(classroomCache(db, 3, 1).items).toHaveLength(1);
      expect(await syncClassroom(db, 3, 1, adapter, false, 1001)).toBe("fresh");
      const broken = {
        ...adapter,
        listFeed: async () => {
          throw new Error("rate_limit");
        },
      };
      expect(await syncClassroom(db, 3, 1, broken, true, 1002)).toBe("error");
      expect(classroomCache(db, 3, 1).items).toHaveLength(1);
      expect(classroomCache(db, 3, 1).state.error).toBe("rate_limit");
    } finally {
      db.close();
    }
  });
  it("removes only the user's mapping and derived cache when the empty option is submitted", async () => {
    const db = fixture();
    try {
      connected(db, 3);
      connected(db, 4);
      const adapter: ClassroomAdapter = {
        listCourses: async () => [
          { id: "shared", name: "Fundamentos Fictícios" },
          { id: "other", name: "Outra turma fictícia" },
        ],
        listFeed: async () => [{ id: "work", title: "Trabalho fictício" }],
      };
      await discoverClassrooms(db, 3, adapter);
      await discoverClassrooms(db, 4, adapter);
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "shared" }]);
      confirmClassrooms(db, 4, [{ offeringId: 2, courseId: "shared" }]);
      expect(await syncClassroom(db, 3, 1, adapter)).toBe("updated");
      expect(await syncClassroom(db, 4, 2, adapter)).toBe("updated");
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "other" }]);
      expect(classroomCache(db, 3, 1).items).toEqual([]);
      expect(await syncClassroom(db, 3, 1, adapter)).toBe("updated");
      expect(() =>
        confirmClassrooms(db, 4, [{ offeringId: 1, courseId: "" }]),
      ).toThrow("Associação duplicada ou sem permissão.");

      const form = new FormData();
      form.set("mapping-1", "");
      confirmClassrooms(db, 3, parseClassroomAssignments(form));
      expect(
        db
          .prepare(
            "SELECT 1 FROM user_classroom_mappings WHERE user_id=3 AND offering_id=1",
          )
          .get(),
      ).toBeUndefined();
      expect(classroomCache(db, 3, 1)).toEqual({
        state: { status: "idle", attempt: null, success: null, error: null },
        items: [],
      });
      expect(
        db
          .prepare(
            "SELECT course_id id FROM user_classroom_mappings WHERE user_id=4 AND offering_id=2",
          )
          .get(),
      ).toEqual({ id: "shared" });
      expect(classroomCache(db, 4, 2).items).toHaveLength(1);
      expect(
        db.prepare("SELECT 1 FROM offerings WHERE id=1").get(),
      ).toBeDefined();
      expect(
        db
          .prepare(
            "SELECT 1 FROM classroom_courses_v2 WHERE user_id=3 AND course_id='shared'",
          )
          .get(),
      ).toBeDefined();
    } finally {
      db.close();
    }
  });
  it("does not restore feed from an in-flight sync after unmapping", async () => {
    const db = fixture();
    try {
      connected(db, 3);
      let finishFeed!: (items: Array<{ id: string; title: string }>) => void;
      const adapter: ClassroomAdapter = {
        listCourses: async () => [
          { id: "shared", name: "Fundamentos Fictícios" },
        ],
        listFeed: async () =>
          new Promise((resolve) => {
            finishFeed = resolve;
          }),
      };
      await discoverClassrooms(db, 3, adapter);
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "shared" }]);
      const pending = syncClassroom(db, 3, 1, adapter);
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "" }]);
      finishFeed([{ id: "late", title: "Resultado atrasado" }]);
      expect(await pending).toBe("superseded");
      expect(classroomCache(db, 3, 1).items).toEqual([]);
      expect(classroomCache(db, 3, 1).state.status).toBe("idle");
    } finally {
      db.close();
    }
  });
  it("allows one user to confirm the same discovered Classroom for two eligible Offerings", async () => {
    const db = fixture();
    try {
      connected(db, 3);
      const adapter: ClassroomAdapter = {
        listCourses: async () => [
          { id: "shared", name: "Fundamentos Fictícios" },
        ],
        listFeed: async () => [],
      };
      await discoverClassrooms(db, 3, adapter);
      expect(
        db.prepare("SELECT count(*) n FROM user_classroom_mappings").get(),
      ).toEqual({ n: 0 });
      confirmClassrooms(db, 3, [
        { offeringId: 1, courseId: "shared" },
        { offeringId: 3, courseId: "shared" },
      ]);
      expect(
        db
          .prepare(
            "SELECT offering_id id FROM user_classroom_mappings WHERE user_id=3 AND course_id='shared' ORDER BY offering_id",
          )
          .all(),
      ).toEqual([{ id: 1 }, { id: 3 }]);
    } finally {
      db.close();
    }
  });
  it("uses the real Classroom adapter boundary with only read requests and the caller's token", async () => {
    const db = fixture();
    try {
      connected(db, 3);
      const seen: string[] = [];
      const fakeFetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        seen.push(String(input));
        expect(init?.method ?? "GET").toBe("GET");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer fake-user-3",
        );
        if (String(input).includes("/courses?"))
          return json({
            courses: [{ id: "personal-3", name: "Fundamentos Fictícios" }],
          });
        if (String(input).includes("/courseWorkMaterials"))
          return json({ courseWorkMaterials: [] });
        if (String(input).includes("/courseWork"))
          return json({ courseWork: [{ id: "w1", title: "Only mine" }] });
        return json({ announcements: [] });
      };
      const adapter = new GoogleClassroomAdapter(
        db,
        fakeFetch as typeof fetch,
        async (_db, id) => `fake-user-${id}`,
      );
      await discoverClassrooms(db, 3, adapter);
      confirmClassrooms(db, 3, [{ offeringId: 1, courseId: "personal-3" }]);
      expect(await syncClassroom(db, 3, 1, adapter)).toBe("updated");
      expect(classroomCache(db, 3, 1).items[0].title).toBe("Only mine");
      expect(
        seen.every((url) =>
          url.startsWith("https://classroom.googleapis.com/"),
        ),
      ).toBe(true);
    } finally {
      db.close();
    }
  });
  it("keeps Local storage usable and Drive owner scoped to a connected normal user", async () => {
    const db = fixture();
    const root = mkdtempSync(join(tmpdir(), "osh-v2-phase3-"));
    try {
      const registry = new StorageRegistry();
      registry.register("Local", new LocalStorageProvider(root));
      const id = await storeObject(
        db,
        registry,
        "Local",
        Buffer.from("fiction"),
      );
      expect(Buffer.from(await readObject(db, registry, id)).toString()).toBe(
        "fiction",
      );
      connected(db, 3, true);
      expect(() => setStorageOwner(db, userActor(3), 3)).toThrow();
      setStorageOwner(db, adminActor(1), 3);
      expect(storageOwnerStatus(db)?.ownerId).toBe(3);
      const backend = storageOwnerStatus(db)!.backendId;
      let rootMissing = false;
      let permissionDenied = false;
      let createdRootName: string | null = null;
      const fakeFetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ) => {
        const url = String(input);
        if (rootMissing && url.includes("/root-fake?")) return json({}, 404);
        if (url.includes("/root-fake?"))
          return json({
            id: "root-fake",
            mimeType: "application/vnd.google-apps.folder",
            trashed: false,
          });
        if (url.includes("/files?fields=id") && init?.method === "POST") {
          const payload = JSON.parse(String(init.body)) as {
            name: string;
            mimeType?: string;
          };
          if (payload.mimeType === "application/vnd.google-apps.folder")
            createdRootName = payload.name;
          return json({
            id: String(init.body).includes("application/vnd.google-apps.folder")
              ? rootMissing
                ? "root-repaired"
                : "root-fake"
              : "file-fake",
          });
        }
        if (permissionDenied && url.includes("/file-fake?alt=media"))
          return json({}, 403);
        if (url.includes("/file-fake?alt=media"))
          return new Response("fiction");
        if (url.includes("/upload/") && init?.method === "PATCH")
          return json({ id: "file-fake" });
        return json({}, 403);
      };
      const provider = new GoogleDriveStorageProvider(
        db,
        backend,
        fakeFetch as typeof fetch,
        async () => "fake-access",
      );
      registry.register("Central Drive", provider);
      expect(await provider.ensureRootFolder("UCSAL - OSH")).toBe("root-fake");
      expect(createdRootName).toBe("UCSAL - OSH");
      expect(await provider.repairRoot(adminActor(1), "UCSAL - OSH")).toBe("root-fake");
      const driveId = await storeObject(
        db,
        registry,
        "Central Drive",
        Buffer.from("fiction"),
      );
      expect(
        Buffer.from(await readObject(db, registry, driveId)).toString(),
      ).toBe("fiction");
      permissionDenied = true;
      await expect(provider.get("file-fake")).rejects.toThrow(
        "Permissão negada",
      );
      permissionDenied = false;
      rootMissing = true;
      await expect(provider.put(Buffer.from("x"))).rejects.toThrow("reparar");
      expect(storageOwnerStatus(db)?.rootReady).toBe(true);
      expect(await provider.repairRoot(adminActor(1), "UCSAL - OSH")).toBe(
        "root-repaired",
      );
      expect(createdRootName).toBe("UCSAL - OSH");
      expect(() => setStorageOwner(db, adminActor(1), null)).toThrow("objetos");
    } finally {
      rmSync(root, { recursive: true, force: true });
      db.close();
    }
  });
});
