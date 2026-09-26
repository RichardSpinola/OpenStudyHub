import { z } from "zod";
import { canonicalChatUserId } from "./chat-state";
import { withV2Db } from "./runtime";

export type ProfileLink = { id: number; label: string; url: string };

function publicUrl(value: string): string {
  const parsed = new URL(z.string().trim().max(500).parse(value));
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Use um endereço HTTPS público.");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":")
  ) {
    throw new Error("Use um endereço HTTPS público.");
  }
  return parsed.toString();
}

export function listProfileLinks(legacyUserId: number): ProfileLink[] {
  return withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    return db
      .prepare(
        "SELECT id,label,url FROM user_profile_links WHERE user_id=? ORDER BY id LIMIT 8",
      )
      .all(userId) as ProfileLink[];
  });
}

export function addProfileLink(
  legacyUserId: number,
  labelInput: string,
  urlInput: string,
): void {
  const label = z.string().trim().min(1).max(60).parse(labelInput);
  const url = publicUrl(urlInput);
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    const count = db
      .prepare("SELECT count(*) count FROM user_profile_links WHERE user_id=?")
      .get(userId) as { count: number };
    if (count.count >= 8) throw new Error("O perfil aceita até oito links.");
    db.prepare(
      "INSERT INTO user_profile_links(user_id,label,url,created_at) VALUES(?,?,?,?)",
    ).run(userId, label, url, Date.now());
  });
}

export function deleteProfileLink(legacyUserId: number, linkId: number): void {
  withV2Db((db) => {
    const userId = canonicalChatUserId(db, legacyUserId);
    db.prepare("DELETE FROM user_profile_links WHERE id=? AND user_id=?").run(
      linkId,
      userId,
    );
  });
}
