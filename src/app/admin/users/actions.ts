"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createMember, resetUserPassword, setUserActive } from "@/lib/access";
import {
  requireAcademicAdministrator,
  requireAdminUser,
} from "@/lib/authorization";
import { clearSessionCookie } from "@/lib/session-cookie";
import { replaceUserEnrollments } from "@/lib/enrollments";
import {
  clearAcademicMembership,
  setAcademicMembership,
} from "@/lib/academic-membership";
import {
  functionalRoleSchema,
  updateFunctionalAuthority,
} from "@/lib/academic-authority";
import { createProfileTag } from "@/lib/collaboration";

const userIdSchema = z.coerce.number().int().positive();

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function usersDestination(ok: boolean): string {
  return `/admin/users?status=${ok ? "ok" : "error"}`;
}

export async function createMemberAction(formData: FormData) {
  const actor = await requireAdminUser();
  let ok = true;
  try {
    await createMember(actor.id, {
      displayName: field(formData, "displayName"),
      login: field(formData, "login"),
      password: field(formData, "password"),
    });
  } catch {
    ok = false;
  }
  redirect(usersDestination(ok));
}

export async function updateFunctionalAuthorityAction(formData: FormData) {
  const actor = await requireAdminUser();
  let ok = true;
  try {
    const functionalRole = functionalRoleSchema.parse(
      field(formData, "functionalRole"),
    );
    const scopeField =
      functionalRole === "moderator"
        ? "programScopeId"
        : functionalRole === "curator"
          ? "cohortScopeId"
          : null;
    updateFunctionalAuthority(
      actor.id,
      userIdSchema.parse(formData.get("userId")),
      functionalRole,
      scopeField
        ? formData.getAll(scopeField).map((value) => userIdSchema.parse(value))
        : [],
    );
  } catch {
    ok = false;
  }
  redirect(usersDestination(ok));
}

export async function setUserActiveAction(formData: FormData) {
  const actor = await requireAdminUser();
  const targetUserId = userIdSchema.parse(formData.get("userId"));
  let ok = true;
  try {
    setUserActive(actor.id, targetUserId, field(formData, "active") === "true");
  } catch {
    ok = false;
  }
  if (ok && actor.id === targetUserId) {
    await clearSessionCookie();
    redirect("/login");
  }
  redirect(usersDestination(ok));
}

export async function resetUserPasswordAction(formData: FormData) {
  const actor = await requireAdminUser();
  const targetUserId = userIdSchema.parse(formData.get("userId"));
  let ok = true;
  try {
    await resetUserPassword(
      actor.id,
      targetUserId,
      field(formData, "password"),
    );
  } catch {
    ok = false;
  }
  if (ok && actor.id === targetUserId) {
    await clearSessionCookie();
    redirect("/login");
  }
  redirect(usersDestination(ok));
}

export async function updateUserEnrollmentsAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    replaceUserEnrollments(
      actor.id,
      userIdSchema.parse(formData.get("userId")),
      formData.getAll("offeringId").map((value) => userIdSchema.parse(value)),
    );
  } catch {
    ok = false;
  }
  redirect(usersDestination(ok));
}

export async function updateAcademicMembershipAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    const targetUserId = userIdSchema.parse(formData.get("userId"));
    const programValue = field(formData, "programId");
    if (!programValue) {
      clearAcademicMembership(actor.id, targetUserId);
    } else {
      const cohortValue = field(formData, "cohortId");
      setAcademicMembership(
        actor.id,
        targetUserId,
        userIdSchema.parse(programValue),
        cohortValue ? userIdSchema.parse(cohortValue) : null,
      );
    }
  } catch {
    ok = false;
  }
  redirect(usersDestination(ok));
}

export async function createProfileTagAction(formData: FormData) {
  const actor = await requireAcademicAdministrator();
  let ok = true;
  try {
    const scopeType = z
      .enum(["instance", "program", "cohort"])
      .parse(field(formData, "scopeType"));
    const programValue = field(formData, "programId");
    const cohortValue = field(formData, "cohortId");
    createProfileTag(actor.id, {
      label: field(formData, "label"),
      scopeType,
      programId: programValue ? userIdSchema.parse(programValue) : null,
      cohortId: cohortValue ? userIdSchema.parse(cohortValue) : null,
      selfAssignable: formData.get("selfAssignable") === "true",
    });
  } catch {
    ok = false;
  }
  redirect(usersDestination(ok));
}
