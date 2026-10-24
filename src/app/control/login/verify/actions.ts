"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withV2Db, ADMIN_COOKIE } from "@/lib/v2/runtime";
import { completeMfaChallenge, MFA_COOKIE } from "@/lib/security/admin-mfa";
import {
  writeV2SessionCookie,
  clearV2SessionCookie,
} from "@/lib/v2/session-cookie";
export async function verifyMfaAction(form: FormData) {
  const token = (await cookies()).get(MFA_COOKIE)?.value ?? "";
  const code = String(form.get("code") ?? "");
  let session = null;
  try {
    if (code.length <= 100)
      session = withV2Db((db) => completeMfaChallenge(db, token, code));
  } catch {
    /* No secret-bearing diagnostics. */
  }
  if (!session) redirect("/control/login/verify?error=1");
  await writeV2SessionCookie(ADMIN_COOKIE, session.token);
  await clearV2SessionCookie(MFA_COOKIE);
  redirect("/control");
}
