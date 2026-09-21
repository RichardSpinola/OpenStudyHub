"use server";

import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit";
import { getSessionByToken, revokeSessionToken } from "@/lib/session";
import { clearSessionCookie, readSessionCookie } from "@/lib/session-cookie";

export async function logoutAction() {
  try {
    const token = await readSessionCookie();
    if (token) {
      let session: ReturnType<typeof getSessionByToken> = null;
      try {
        session = getSessionByToken(token);
      } catch {
        // Session lookup must not prevent the client-side session from ending.
      }

      let revoked = false;
      try {
        revoked = revokeSessionToken(token);
      } catch {
        // Cookie removal remains mandatory if persistent revocation is unavailable.
      }

      if (session && revoked) {
        try {
          recordAuditEvent({
            actorUserId: session.user.id,
            action: "auth.logout",
            targetType: "session",
            targetId: String(session.id),
            summary: "local session revoked by logout",
          });
        } catch {
          // Audit is best effort and cannot block logout.
        }
      }
    }
  } finally {
    await clearSessionCookie();
  }

  redirect("/login");
}
