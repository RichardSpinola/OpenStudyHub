import { redirect } from "next/navigation";

import { isSetupRequired } from "@/lib/access";
import { canAccessAdministration } from "@/lib/access-policy";
import { assertAcademicAdministrator } from "@/lib/academic-authority";
import { getSessionByToken, type SessionRecord } from "@/lib/session";
import { readSessionCookie } from "@/lib/session-cookie";
import { getUserProfile } from "@/lib/profile";
import { projectLegacySession } from "@/lib/v2/identity-bridge";
import { readUserSessionTokenV2, withV2Db } from "@/lib/v2/runtime";

export async function getCurrentSession(): Promise<SessionRecord | null> {
  try {
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
      const token = await readUserSessionTokenV2();
      return token ? withV2Db((db) => projectLegacySession(db, token)) : null;
    }
    const token = await readSessionCookie();
    return token ? getSessionByToken(token) : null;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession();
  if (!session)
    redirect(
      process.env.OPENSTUDYHUB_V2_ENABLED === "1"
        ? "/login"
        : isSetupRequired()
          ? "/setup"
          : "/login",
    );
  if (getUserProfile(session.user.id).onboardingVersion < 1) {
    redirect("/onboarding");
  }
  return session.user;
}

export async function requireAdminUser() {
  const user = await requireAuthenticatedUser();
  if (!canAccessAdministration(user)) redirect("/");
  return user;
}

export async function requireAcademicAdministrator() {
  const user = await requireAuthenticatedUser();
  try {
    assertAcademicAdministrator(user.id);
  } catch {
    redirect("/");
  }
  return user;
}
