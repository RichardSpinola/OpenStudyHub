"use server";

import { redirect } from "next/navigation";

import { bootstrapFirstAdmin, isSetupRequired } from "@/lib/access";
import { createSession } from "@/lib/session";
import { writeSessionCookie } from "@/lib/session-cookie";

export type SetupActionState = { status: "idle" | "error" };

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function completeSetupAction(
  _state: SetupActionState,
  formData: FormData,
): Promise<SetupActionState> {
  if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") redirect("/control/setup");
  if (!isSetupRequired()) redirect("/login");

  const password = field(formData, "password");
  if (password !== field(formData, "confirmPassword")) {
    return { status: "error" };
  }

  let user;
  try {
    user = await bootstrapFirstAdmin({
      displayName: field(formData, "displayName"),
      login: field(formData, "login"),
      password,
      institutionName: field(formData, "institutionName"),
      language: field(formData, "language") as "pt-BR" | "en",
      academic: {
        programName: field(formData, "programName"),
        programShortName: field(formData, "programShortName"),
        cohortName: field(formData, "cohortName"),
        periodLabel: field(formData, "periodLabel"),
        periodStartsOn: field(formData, "periodStartsOn"),
        periodEndsOn: field(formData, "periodEndsOn"),
        subjectName: field(formData, "subjectName"),
        expectedPeriods: field(formData, "expectedPeriods")
          ? Number(field(formData, "expectedPeriods"))
          : null,
        includeCohortInStorage:
          formData.get("includeCohortInStorage") === "true",
      },
    });
  } catch {
    return { status: "error" };
  }

  const session = createSession(user.id);
  await writeSessionCookie(session.token, session.expiresAt);
  redirect("/settings#google-title");
}
