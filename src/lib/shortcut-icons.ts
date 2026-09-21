import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";
import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { getServerEnvironment } from "@/lib/env";

const id = z.number().int().positive();
const maxIconBytes = 512 * 1024;
export type ShortcutIconScope = "instance" | "user";

function privateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  )
    return true;
  const ipv4 = normalized.startsWith("::ffff:")
    ? normalized.slice(7)
    : normalized;
  if (!/^\d+[.]\d+[.]\d+[.]\d+$/u.test(ipv4)) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicHost(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost"))
    throw new Error("Unsafe host.");
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => privateAddress(address))
  ) {
    throw new Error("Unsafe host.");
  }
}

async function safeFetch(
  url: URL,
  fetchImpl: typeof fetch,
  accept: string,
): Promise<Response> {
  let current = url;
  for (let count = 0; count < 4; count += 1) {
    if (!["http:", "https:"].includes(current.protocol))
      throw new Error("Unsafe URL.");
    await assertPublicHost(current.hostname);
    const response = await fetchImpl(current, {
      redirect: "manual",
      headers: { accept },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Invalid redirect.");
      current = new URL(location, current);
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects.");
}

async function decodeIconResponse(response: Response): Promise<Buffer | null> {
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > maxIconBytes) return null;
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > maxIconBytes) return null;
  try {
    return await sharp(data, {
      failOn: "warning",
      limitInputPixels: 4_000_000,
    })
      .resize(64, 64, { fit: "contain" })
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function discoverFromHomepage(
  pageUrl: URL,
  fetchImpl: typeof fetch,
): Promise<URL | null> {
  const response = await safeFetch(
    pageUrl,
    fetchImpl,
    "text/html,application/xhtml+xml",
  );
  if (!response.ok) return null;
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > 256 * 1024) return null;
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > 256 * 1024) return null;
  const html = data.toString("utf8");
  const linkTags = html.match(/<link\b[^>]*>/giu) ?? [];
  for (const tag of linkTags) {
    const rel = /\brel\s*=\s*["']([^"']+)["']/iu.exec(tag)?.[1] ?? "";
    if (!/(^|\s)(shortcut\s+icon|icon|apple-touch-icon)(\s|$)/iu.test(rel))
      continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/iu.exec(tag)?.[1];
    if (!href) continue;
    try {
      return new URL(href, pageUrl);
    } catch {
      continue;
    }
  }
  return null;
}

function iconRoot(root?: string) {
  return resolve(
    root ?? getServerEnvironment().PRIVATE_ASSET_PATH,
    "shortcut-icons",
  );
}

function safePath(storageName: string, root?: string) {
  if (!/^[a-f0-9-]+[.]png$/u.test(storageName))
    throw new Error("Invalid icon reference.");
  const base = iconRoot(root);
  const path = resolve(base, storageName);
  if (!path.startsWith(`${base}/`)) throw new Error("Invalid icon path.");
  return path;
}

export async function discoverShortcutIcon(
  scope: ShortcutIconScope,
  shortcutId: number,
  ownerUserId: number | null,
  shortcutUrl: string,
  options: {
    connection?: DatabaseConnection;
    assetRoot?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<boolean> {
  try {
    const targetId = id.parse(shortcutId);
    const pageUrl = new URL(shortcutUrl);
    const fetchImpl = options.fetchImpl ?? fetch;
    const faviconUrl = new URL("/favicon.ico", pageUrl);
    let output = await decodeIconResponse(
      await safeFetch(
        faviconUrl,
        fetchImpl,
        "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,*/*;q=0.1",
      ),
    );
    if (!output) {
      const discovered = await discoverFromHomepage(pageUrl, fetchImpl);
      if (discovered) {
        output = await decodeIconResponse(
          await safeFetch(
            discovered,
            fetchImpl,
            "image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,*/*;q=0.1",
          ),
        );
      }
    }
    if (!output) return false;
    const connection = options.connection ?? getDatabase();
    const table = scope === "user" ? "user_shortcuts" : "shortcuts";
    const ownerClause = scope === "user" ? " and user_id = ?" : "";
    const parameters =
      scope === "user" ? [targetId, id.parse(ownerUserId)] : [targetId];
    const previous = connection.sqlite
      .prepare(
        `select icon_storage_name as storageName from ${table} where id = ?${ownerClause}`,
      )
      .get(...parameters) as { storageName: string | null } | undefined;
    if (!previous) return false;
    const storageName = `${randomUUID()}.png`;
    const finalPath = safePath(storageName, options.assetRoot);
    await mkdir(iconRoot(options.assetRoot), { recursive: true, mode: 0o700 });
    await writeFile(`${finalPath}.tmp`, output, { flag: "wx", mode: 0o600 });
    await rename(`${finalPath}.tmp`, finalPath);
    connection.sqlite
      .prepare(
        `update ${table} set icon_storage_name = ?, icon_mime_type = 'image/png', updated_at = ? where id = ?${ownerClause}`,
      )
      .run(storageName, Date.now(), ...parameters);
    if (previous.storageName)
      await unlink(safePath(previous.storageName, options.assetRoot)).catch(
        () => undefined,
      );
    return true;
  } catch {
    return false;
  }
}

export async function readShortcutIcon(
  scope: ShortcutIconScope,
  shortcutId: number,
  userId: number,
  options: { connection?: DatabaseConnection; assetRoot?: string } = {},
): Promise<{ data: Buffer; mimeType: string } | null> {
  const connection = options.connection ?? getDatabase();
  const row =
    scope === "user"
      ? connection.sqlite
          .prepare(
            "select icon_storage_name as storageName, icon_mime_type as mimeType from user_shortcuts where id = ? and user_id = ?",
          )
          .get(id.parse(shortcutId), id.parse(userId))
      : connection.sqlite
          .prepare(
            "select icon_storage_name as storageName, icon_mime_type as mimeType from shortcuts where id = ? and enabled = 1",
          )
          .get(id.parse(shortcutId));
  const icon = row as
    { storageName: string | null; mimeType: string | null } | undefined;
  if (!icon?.storageName || !icon.mimeType) return null;
  try {
    return {
      data: await readFile(safePath(icon.storageName, options.assetRoot)),
      mimeType: icon.mimeType,
    };
  } catch {
    return null;
  }
}
