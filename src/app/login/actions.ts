"use server";

import { redirect } from "next/navigation";

import { authenticateLocalUser, isSetupRequired } from "@/lib/access";
import { createSession } from "@/lib/session";
import { writeSessionCookie } from "@/lib/session-cookie";
import { getUserProfile } from "@/lib/profile";

export type LoginActionState = { status: "idle" | "invalid" };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _state: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (isSetupRequired()) redirect("/setup");

  const user = await authenticateLocalUser(
    field(formData, "login"),
    field(formData, "password"),
  );
  if (!user) return { status: "invalid" };

  const session = createSession(user.id);
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(getUserProfile(user.id).onboardingVersion < 1 ? "/onboarding" : "/");
}
