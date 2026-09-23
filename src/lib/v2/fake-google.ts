import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { V2Database } from "./database";
import { v2RuntimePath } from "./runtime";
import {
  CLASSROOM_SCOPES,
  DRIVE_SCOPE,
  GOOGLE_V2_CALLBACK,
  type GoogleV2Config,
} from "./google-config";
import { GoogleClassroomAdapter } from "./classroom";
import { GoogleDriveStorageProvider } from "./drive-storage";
import { googleAccessTokenV2 } from "./google-oauth";

export function fakeGoogleEnabled(): boolean {
  if (
    process.env.OPENSTUDYHUB_V2_FAKE_GOOGLE !== "1" ||
    process.env.NODE_ENV === "production"
  )
    return false;
  try {
    const path = v2RuntimePath();
    const runtime = dirname(dirname(path));
    return (
      path === join(runtime, "data", "v2-fake.db") &&
      runtime.endsWith("/OpenStudyHub-v2-runtime") &&
      readFileSync(join(runtime, ".fake-runtime-marker"), "utf8") ===
        "OPENSTUDYHUB_V2_FAKE_RUNTIME_ONLY\n"
    );
  } catch {
    return false;
  }
}
function requireFake() {
  if (!fakeGoogleEnabled()) throw new Error("Google fictício indisponível.");
}
export function fakeGoogleConfig(): GoogleV2Config {
  requireFake();
  return {
    clientId: "fake-client",
    clientSecret: "fake-secret",
    redirectUri: new URL(
      GOOGLE_V2_CALLBACK,
      process.env.APP_URL || "http://localhost:3000",
    ).toString(),
    encryptionKey: Buffer.alloc(32, 7),
  };
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
function fakeDriveTable(db: V2Database) {
  requireFake();
  db.exec(`CREATE TABLE IF NOT EXISTS fake_google_drive_objects (
    id TEXT PRIMARY KEY, mime_type TEXT NOT NULL, bytes BLOB,
    trashed INTEGER NOT NULL DEFAULT 0
  )`);
}
export function fakeGoogleFetch(db: V2Database, userId: number): typeof fetch {
  requireFake();
  return async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method || "GET";
    if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") {
      const body = new URLSearchParams(String(init?.body ?? ""));
      if (body.get("grant_type") === "authorization_code")
        return json({
          access_token: `fake-access-${userId}`,
          refresh_token: `fake-refresh-${userId}`,
          scope: [...CLASSROOM_SCOPES, DRIVE_SCOPE].join(" "),
        });
      if (body.get("grant_type") === "refresh_token")
        return json({ access_token: `fake-access-${userId}` });
    }
    if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/revoke")
      return json({});
    if (url.hostname === "openidconnect.googleapis.com")
      return json({
        sub: `fake-google-${userId}`,
        email: `fictional-${userId}@example.invalid`,
      });
    if (url.hostname === "classroom.googleapis.com") {
      if (url.pathname === "/v1/courses")
        return json({
          courses: [
            {
              id: `fake-${userId}-math`,
              name: "Fundamentos Fictícios",
              section: "M",
            },
            {
              id: `fake-${userId}-practice`,
              name: "Prática Fictícia",
              section: "M",
            },
            {
              id: `fake-${userId}-other`,
              name: "Estudos de Exemplo",
              section: "B",
            },
          ],
        });
      if (url.pathname.endsWith("/courseWork"))
        return json({
          courseWork: [
            {
              id: "fake-work",
              title: "Atividade fictícia",
              alternateLink: "https://classroom.google.com/",
            },
          ],
        });
      if (url.pathname.endsWith("/courseWorkMaterials"))
        return json({ courseWorkMaterials: [] });
      if (url.pathname.endsWith("/announcements"))
        return json({ announcements: [] });
    }
    if (
      url.hostname === "www.googleapis.com" &&
      url.pathname.includes("/drive/v3/files")
    ) {
      fakeDriveTable(db);
      const id = url.pathname.split("/").at(-1)!;
      if (method === "POST" && url.pathname === "/drive/v3/files") {
        const meta = JSON.parse(String(init?.body ?? "{}")) as {
          mimeType?: string;
        };
        const next = randomUUID();
        db.prepare(
          "INSERT INTO fake_google_drive_objects(id,mime_type) VALUES(?,?)",
        ).run(next, meta.mimeType ?? "application/octet-stream");
        return json({ id: next });
      }
      const file = db
        .prepare(
          "SELECT mime_type mime,bytes,trashed FROM fake_google_drive_objects WHERE id=?",
        )
        .get(id) as
        { mime: string; bytes: Buffer | null; trashed: number } | undefined;
      if (!file || file.trashed) return json({}, 404);
      if (method === "GET" && url.searchParams.get("alt") === "media")
        return new Response(new Uint8Array(file.bytes ?? Buffer.alloc(0)));
      if (method === "GET")
        return json({ id, mimeType: file.mime, trashed: false });
      if (method === "PATCH" && url.pathname.includes("/upload/")) {
        db.prepare(
          "UPDATE fake_google_drive_objects SET bytes=? WHERE id=?",
        ).run(Buffer.from(init?.body as Uint8Array), id);
        return json({ id });
      }
      if (method === "PATCH") {
        db.prepare(
          "UPDATE fake_google_drive_objects SET trashed=1 WHERE id=?",
        ).run(id);
        return json({ id });
      }
    }
    return json({}, 404);
  };
}
export function fakeClassroomAdapter(db: V2Database, userId: number) {
  requireFake();
  const fetchImpl = fakeGoogleFetch(db, userId);
  return new GoogleClassroomAdapter(db, fetchImpl, (database, id) =>
    googleAccessTokenV2(database, id, {
      config: fakeGoogleConfig(),
      fetchImpl,
    }),
  );
}
export function fakeDriveProvider(
  db: V2Database,
  backendId: number,
  ownerId: number,
) {
  requireFake();
  const fetchImpl = fakeGoogleFetch(db, ownerId);
  return new GoogleDriveStorageProvider(
    db,
    backendId,
    fetchImpl,
    (database, id) =>
      googleAccessTokenV2(database, id, {
        config: fakeGoogleConfig(),
        fetchImpl,
      }),
  );
}
