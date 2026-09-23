"use server";

import { redirect } from "next/navigation";

import { authenticateLocalUser, isSetupRequired } from "@/lib/access";
import { createSession } from "@/lib/session";
import { clearSessionCookie, writeSessionCookie } from "@/lib/session-cookie";
import { getUserProfile } from "@/lib/profile";
import {
  authenticateNormal,
  projectLegacySession,
} from "@/lib/v2/identity-bridge";
import { sessionUserV2 } from "@/lib/v2/auth";
import { withV2DbAsync, writeUserSessionV2 } from "@/lib/v2/runtime";

export type LoginActionState = { status: "idle" | "invalid" };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _state: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (process.env.OPENSTUDYHUB_V2_ENABLED !== "1" && isSetupRequired())
    redirect("/setup");

  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
    let normal: {
      token: string;
      legacyId: number | null;
      mustChangePassword: boolean;
    } | null = null;
    try {
      normal = await withV2DbAsync(async (db) => {
        const result = await authenticateNormal(
          db,
          field(formData, "login"),
          field(formData, "password"),
        );
        if (!result) return null;
        const user = sessionUserV2(db, result.token);
        return {
          token: result.token,
          legacyId: projectLegacySession(db, result.token)?.user.id ?? null,
          mustChangePassword: !!user?.mustChangePassword,
        };
      });
    } catch {
      return { status: "invalid" };
    }
    if (!normal || (!normal.mustChangePassword && !normal.legacyId))
      return { status: "invalid" };
    await writeUserSessionV2(normal.token);
    await clearSessionCookie();
    if (normal.mustChangePassword) redirect("/gestao/password");
    redirect(
      getUserProfile(normal.legacyId!).onboardingVersion < 1
        ? "/onboarding"
        : "/",
    );
  }

  const user = await authenticateLocalUser(
    field(formData, "login"),
    field(formData, "password"),
  );
  if (!user) return { status: "invalid" };

  const session = createSession(user.id);
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(getUserProfile(user.id).onboardingVersion < 1 ? "/onboarding" : "/");
}
