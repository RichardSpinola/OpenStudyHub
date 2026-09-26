import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { getAcademicMembership } from "@/lib/academic-membership";
import { getAppearance } from "@/lib/appearance";
import { currentUserV2, withV2DbAsync } from "@/lib/v2/runtime";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const q = await searchParams;
  const replay = q.replay === "1";
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const profile = getUserProfile(session.user.id);
  if (profile.onboardingVersion >= 1 && !replay) redirect("/");
  const v2 = process.env.OPENSTUDYHUB_V2_ENABLED === "1";
  const state = v2
    ? await withV2DbAsync(async (db) => {
        const user = await currentUserV2(db);
        if (!user) return null;
        const progress = db
          .prepare("SELECT step FROM user_onboarding_progress WHERE user_id=?")
          .get(user.id) as { step: number } | undefined;
        const academic = db
          .prepare(
            `SELECT p.name course,c.name cohort,ap.label period,cs.ordinal semester
      FROM user_academic_contexts x JOIN programs p ON p.id=x.program_id JOIN cohorts c ON c.id=x.cohort_id
      JOIN cohort_periods cp ON cp.id=x.cohort_period_id JOIN academic_periods ap ON ap.id=cp.period_id
      JOIN curriculum_semesters cs ON cs.id=cp.semester_id
      WHERE x.user_id=? AND x.current=1 ORDER BY x.id DESC LIMIT 1`,
          )
          .get(user.id) as
          | { course: string; cohort: string; period: string; semester: number }
          | undefined;
        const google = db
          .prepare("SELECT status FROM google_connections_v2 WHERE user_id=?")
          .get(user.id) as { status: string } | undefined;
        return {
          initialStep: progress?.step ?? 0,
          academic,
          googleConnected: google?.status === "connected",
        };
      })
    : null;
  const v1Academic = !v2 ? getAcademicMembership(session.user.id) : null;
  const appearance = getAppearance(session.user.id);
  return (
    <OnboardingWizard
      key={replay ? "replay" : "first-run"}
      replay={replay}
      initialStep={replay ? 0 : (state?.initialStep ?? 0)}
      userId={session.user.id}
      login={session.user.login}
      profile={{
        displayName: profile.displayName,
        bio: profile.bio,
        locale: profile.locale,
        hasAvatar: Boolean(profile.avatarStorageName),
        hasBanner: Boolean(profile.bannerStorageName),
      }}
      academic={
        state?.academic ??
        (v1Academic
          ? {
              course: v1Academic.programName,
              cohort: v1Academic.cohortName ?? "A definir",
              period: "A definir",
              semester: 0,
            }
          : null)
      }
      googleConnected={state?.googleConnected ?? false}
      appearance={{
        theme: appearance.theme,
        mode: appearance.mode,
        accent: appearance.accent,
        customAccent: appearance.customAccent,
      }}
    />
  );
}
