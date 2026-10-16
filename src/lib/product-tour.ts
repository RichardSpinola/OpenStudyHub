import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "./db/client";
import {
  PRODUCT_TOUR_EDITION,
  tourSteps,
  type TourMode,
  type TourStatus,
  type TourStep,
} from "./product-tour-catalog";
import { getUserProfile } from "./profile";
import { personalPlanningContext } from "./personal-planning-context";
import { isProjectsFeatureEnabled } from "./feature-flags";
import { withV2Db } from "./v2/runtime-database";
import { getExtrasFlags } from "./v2/extras";
import { examForLegacyUser } from "./v2/exam-access";
export type TourProgress = {
  edition: number;
  status: TourStatus;
  mode: TourMode;
  stepId: string | null;
  revision: number;
};
export type ProductTourContext = {
  userId: number;
  eligible: boolean;
  invitationEnabled: boolean;
  newUser: boolean;
  steps: TourStep[];
  progress: TourProgress | null;
};
export function tourInvitationEnabled(
  connection: DatabaseConnection = getDatabase(),
) {
  return (
    (
      connection.sqlite
        .prepare(
          "SELECT value FROM app_settings WHERE key='tour.invitation_enabled'",
        )
        .get() as { value: string } | undefined
    )?.value !== "false"
  );
}
export function readTourProgress(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): TourProgress | null {
  return (
    (connection.sqlite
      .prepare(
        "SELECT edition,status,mode,step_id stepId,revision FROM user_product_tours WHERE user_id=?",
      )
      .get(z.number().int().positive().parse(userId)) as
      TourProgress | undefined) ?? null
  );
}
export function productTourContext(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): ProductTourContext {
  const profile = getUserProfile(userId, connection),
    progress = readTourProgress(userId, connection);
  const created = (
    connection.sqlite
      .prepare("SELECT created_at t FROM users WHERE id=?")
      .get(userId) as { t: number }
  ).t;
  const since = Number(
    (
      connection.sqlite
        .prepare(
          "SELECT value FROM app_settings WHERE key='tour.edition.1.available_since'",
        )
        .get() as { value: string } | undefined
    )?.value ?? Date.now(),
  );
  const context: ProductTourContext = {
    userId,
    eligible: profile.onboardingVersion >= 1 && !examForLegacyUser(userId),
    invitationEnabled: tourInvitationEnabled(connection),
    newUser: created >= since,
    steps: [],
    progress,
  };
  if (!context.eligible) return context;
  const flags =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? withV2Db(getExtrasFlags)
      : null;
  const subject = personalPlanningContext(userId, connection).offerings[0];
  context.steps = tourSteps
    .filter((s) => {
      if (s.id === "subject" && !subject) return false;
      if (s.feature === "projects") return isProjectsFeatureEnabled(connection);
      return !s.feature || !!(flags?.extras && flags[s.feature]);
    })
    .map((s) =>
      s.id === "subject"
        ? { ...s, path: `/subjects/${subject!.subjectId}` }
        : { ...s },
    );
  return context;
}
export const tourProgressInput = z.object({
  edition: z.literal(PRODUCT_TOUR_EDITION),
  status: z.enum(["active", "paused", "dismissed", "completed"]),
  mode: z.enum(["full", "news"]),
  stepId: z.string().max(64).nullable(),
  revision: z.number().int().min(0),
});
export function writeTourProgress(
  userId: number,
  input: z.input<typeof tourProgressInput>,
  allowed: TourStep[],
  connection: DatabaseConnection = getDatabase(),
) {
  const value = tourProgressInput.parse(input);
  if (
    value.stepId !== null &&
    !allowed.some(
      (s) => s.id === value.stepId && (value.mode === "full" || s.news),
    )
  )
    throw new Error("step");
  if (
    (value.status === "active" || value.status === "paused") &&
    value.stepId === null
  )
    throw new Error("step");
  return connection.sqlite.transaction(() => {
    const old = readTourProgress(userId, connection);
    if ((old?.revision ?? 0) !== value.revision)
      return { conflict: true as const, progress: old };
    connection.sqlite
      .prepare(
        `INSERT INTO user_product_tours(user_id,edition,status,mode,step_id,revision,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET edition=excluded.edition,status=excluded.status,mode=excluded.mode,step_id=excluded.step_id,revision=excluded.revision,updated_at=excluded.updated_at`,
      )
      .run(
        userId,
        value.edition,
        value.status,
        value.mode,
        value.stepId,
        value.revision + 1,
        Date.now(),
      );
    return {
      conflict: false as const,
      progress: readTourProgress(userId, connection)!,
    };
  })();
}
