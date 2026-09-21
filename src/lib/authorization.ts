import { redirect } from "next/navigation";

import { isSetupRequired } from "@/lib/access";
import { canAccessAdministration } from "@/lib/access-policy";
import { assertAcademicAdministrator } from "@/lib/academic-authority";
import { getSessionByToken, type SessionRecord } from "@/lib/session";
import { readSessionCookie } from "@/lib/session-cookie";
import { getUserProfile } from "@/lib/profile";

export async function getCurrentSession(): Promise<SessionRecord | null> {
  try {
    const token = await readSessionCookie();
    return token ? getSessionByToken(token) : null;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const session = await getCurrentSession();
  if (!session) redirect(isSetupRequired() ? "/setup" : "/login");
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
