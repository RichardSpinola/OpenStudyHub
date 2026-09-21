import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { isUserEnrolled } from "@/lib/enrollments";
import { listUserSubjectOfferings } from "@/lib/academic";

import { getGoogleAccessToken, type GoogleFetch } from "./oauth";
import {
  getOfferingGoogleIntegration,
  listOfferingGoogleIntegrations,
} from "./offering-integrations";

const CLASSROOM_ENDPOINT = "https://classroom.googleapis.com/v1";
const idSchema = z.number().int().positive();
const courseWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  alternateLink: z.string().optional(),
  creationTime: z.string().optional(),
  updateTime: z.string().optional(),
  dueDate: z
    .object({ year: z.number(), month: z.number(), day: z.number() })
    .optional(),
  dueTime: z
    .object({ hours: z.number().optional(), minutes: z.number().optional() })
    .optional(),
});
const courseWorkListSchema = z.object({
  courseWork: z.array(courseWorkSchema).optional().default([]),
  nextPageToken: z.string().optional(),
});
const submissionSchema = z.object({
  courseWorkId: z.string().min(1),
  state: z.string().optional(),
});
const submissionsListSchema = z.object({
  studentSubmissions: z.array(submissionSchema).optional().default([]),
  nextPageToken: z.string().optional(),
});
const courseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  section: z.string().optional(),
  alternateLink: z.string().optional(),
  courseState: z.string().optional(),
});
const coursesListSchema = z.object({
  courses: z.array(courseSchema).optional().default([]),
  nextPageToken: z.string().optional(),
});
export type ClassroomCourse = z.infer<typeof courseSchema>;
export type ClassroomFeedItem = {
  id: number;
  offeringId: number;
  type: "announcement" | "coursework" | "material";
  title: string;
  excerpt: string | null;
  externalUrl: string | null;
  publishedAt: number | null;
};
export type ClassroomSyncState = {
  lastAttemptAt: number | null;
  lastSuccessfulSyncAt: number | null;
  lastErrorCode: string | null;
};
export type ClassroomSyncAllResult = {
  offeringId: number;
  subjectName: string;
  status: "fresh" | "synced" | "error";
  activities?: number;
};
const materialSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  alternateLink: z.string().optional(),
  updateTime: z.string().optional(),
});
const materialsListSchema = z.object({
  courseWorkMaterial: z.array(materialSchema).optional().default([]),
  nextPageToken: z.string().optional(),
});
const announcementSchema = z.object({
  id: z.string().min(1),
  text: z.string().optional().default(""),
  alternateLink: z.string().optional(),
  updateTime: z.string().optional(),
  state: z.string().optional(),
});
const announcementsListSchema = z.object({
  announcements: z.array(announcementSchema).optional().default([]),
  nextPageToken: z.string().optional(),
});

function dueTimestamp(work: z.infer<typeof courseWorkSchema>): number | null {
  if (!work.dueDate) return null;
  return Date.UTC(
    work.dueDate.year,
    work.dueDate.month - 1,
    work.dueDate.day,
    work.dueTime?.hours ?? 23,
    work.dueTime?.minutes ?? 59,
  );
}

function activityStatus(state: string | undefined) {
  if (state === "RETURNED") return "completed" as const;
  if (state === "TURNED_IN") return "submitted" as const;
  return "pending" as const;
}

async function classroomGet(
  accessToken: string,
  path: string,
  parameters: Record<string, string>,
  fetchImpl: GoogleFetch,
) {
  const url = new URL(`${CLASSROOM_ENDPOINT}/${path}`);
  for (const [key, value] of Object.entries(parameters)) {
    url.searchParams.set(key, value);
  }
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Classroom read failed.");
  return response.json();
}

export async function listClassroomCourses(
  userId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const items: Array<z.infer<typeof courseSchema>> = [];
  let pageToken: string | undefined;
  do {
    const page = coursesListSchema.parse(
      await classroomGet(
        accessToken,
        "courses",
        {
          courseStates: "ACTIVE",
          pageSize: "100",
          ...(pageToken ? { pageToken } : {}),
        },
        fetchImpl,
      ),
    );
    items.push(...page.courses);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

export async function getClassroomCourse(
  userId: number,
  courseId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
): Promise<ClassroomCourse> {
  const ownerId = idSchema.parse(userId);
  const safeCourseId = z.string().trim().min(1).max(255).parse(courseId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  return courseSchema.parse(
    await classroomGet(
      accessToken,
      `courses/${encodeURIComponent(safeCourseId)}`,
      {},
      fetchImpl,
    ),
  );
}

export async function listClassroomCourseMaterials(
  userId: number,
  courseId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const safeCourseId = z.string().trim().min(1).max(255).parse(courseId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const page = materialsListSchema.parse(
    await classroomGet(
      accessToken,
      `courses/${encodeURIComponent(safeCourseId)}/courseWorkMaterials`,
      { pageSize: "100" },
      fetchImpl,
    ),
  );
  return page.courseWorkMaterial;
}

export async function listClassroomAnnouncements(
  userId: number,
  courseId: string,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
  } = {},
) {
  const ownerId = idSchema.parse(userId);
  const safeCourseId = z.string().trim().min(1).max(255).parse(courseId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const page = announcementsListSchema.parse(
    await classroomGet(
      accessToken,
      `courses/${encodeURIComponent(safeCourseId)}/announcements`,
      { announcementStates: "PUBLISHED", pageSize: "100" },
      fetchImpl,
    ),
  );
  return page.announcements;
}

async function listAllCourseWork(
  accessToken: string,
  courseId: string,
  fetchImpl: GoogleFetch,
) {
  const items: Array<z.infer<typeof courseWorkSchema>> = [];
  let pageToken: string | undefined;
  do {
    const page = courseWorkListSchema.parse(
      await classroomGet(
        accessToken,
        `courses/${encodeURIComponent(courseId)}/courseWork`,
        { pageSize: "100", ...(pageToken ? { pageToken } : {}) },
        fetchImpl,
      ),
    );
    items.push(...page.courseWork);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

async function listOwnSubmissions(
  accessToken: string,
  courseId: string,
  courseWorkId: string,
  fetchImpl: GoogleFetch,
) {
  const items: Array<z.infer<typeof submissionSchema>> = [];
  let pageToken: string | undefined;
  do {
    const page = submissionsListSchema.parse(
      await classroomGet(
        accessToken,
        `courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(courseWorkId)}/studentSubmissions`,
        {
          userId: "me",
          pageSize: "100",
          ...(pageToken ? { pageToken } : {}),
        },
        fetchImpl,
      ),
    );
    items.push(...page.studentSubmissions);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items[0];
}

export async function syncClassroomActivities(
  userId: number,
  offeringId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    includeHistory?: boolean;
  } = {},
): Promise<number> {
  const ownerId = idSchema.parse(userId);
  const targetId = idSchema.parse(offeringId);
  const connection = options.connection ?? getDatabase();
  if (!isUserEnrolled(ownerId, targetId, connection)) {
    throw new Error("Offering is outside the user's academic context.");
  }
  const integration = getOfferingGoogleIntegration(targetId, connection);
  if (!integration?.classroomCourseId) {
    throw new Error("Classroom course is not configured.");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = await getGoogleAccessToken(ownerId, {
    connection,
    fetchImpl,
  });
  const allWorkItems = await listAllCourseWork(
    accessToken,
    integration.classroomCourseId,
    fetchImpl,
  );
  const period = connection.sqlite
    .prepare(
      `select ap.starts_on as startsOn
       from subject_offerings so
       join academic_periods ap on ap.id = so.academic_period_id
       where so.id = ?`,
    )
    .get(targetId) as { startsOn: string } | undefined;
  const periodStart = period ? Date.parse(`${period.startsOn}T00:00:00Z`) : 0;
  const workItems = options.includeHistory
    ? allWorkItems
    : allWorkItems.filter((work) => {
        const reference = work.dueDate
          ? dueTimestamp(work)
          : Date.parse(work.creationTime ?? work.updateTime ?? "");
        return (
          reference === null ||
          Number.isNaN(reference) ||
          reference >= periodStart
        );
      });
  const submissions = new Map<string, string | undefined>();
  for (const work of workItems) {
    const submission = await listOwnSubmissions(
      accessToken,
      integration.classroomCourseId,
      work.id,
      fetchImpl,
    );
    submissions.set(work.id, submission?.state);
  }

  const now = Date.now();
  connection.sqlite.transaction(() => {
    const upsert = connection.sqlite.prepare(
      `insert into activities
       (user_id, offering_id, title, description, due_at, status, origin,
        external_source, external_id, external_url, external_updated_at,
        created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'external', 'classroom', ?, ?, ?, ?, ?)
       on conflict(user_id, external_source, external_id) do update set
         offering_id = excluded.offering_id,
         title = excluded.title,
         description = excluded.description,
         due_at = excluded.due_at,
         status = excluded.status,
         external_url = excluded.external_url,
         external_updated_at = excluded.external_updated_at,
         updated_at = excluded.updated_at`,
    );
    for (const work of workItems) {
      upsert.run(
        ownerId,
        targetId,
        work.title,
        work.description ?? null,
        dueTimestamp(work),
        activityStatus(submissions.get(work.id)),
        `${integration.classroomCourseId}:${work.id}`,
        work.alternateLink ?? null,
        work.updateTime ? Date.parse(work.updateTime) : null,
        now,
        now,
      );
    }
    recordAuditEvent(
      {
        actorUserId: ownerId,
        action: "google.classroom_sync",
        targetType: "subject_offering",
        targetId: String(targetId),
        summary: `${workItems.length} Classroom activities synchronized`,
      },
      connection,
    );
  })();
  return workItems.length;
}

function shortExcerpt(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().replaceAll(/\s+/g, " ").slice(0, 500);
}

export function getClassroomSyncState(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): ClassroomSyncState | null {
  return (
    (connection.sqlite
      .prepare(
        `select last_attempt_at as lastAttemptAt,
                last_successful_sync_at as lastSuccessfulSyncAt,
                last_error_code as lastErrorCode
         from classroom_sync_states where user_id = ? and offering_id = ?`,
      )
      .get(idSchema.parse(userId), idSchema.parse(offeringId)) as
      ClassroomSyncState | undefined) ?? null
  );
}

export function listClassroomFeedItems(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): ClassroomFeedItem[] {
  if (!isUserEnrolled(userId, offeringId, connection)) return [];
  return connection.sqlite
    .prepare(
      `select id, offering_id as offeringId, type, title, excerpt,
              external_url as externalUrl, published_at as publishedAt
       from classroom_feed_items
       where user_id = ? and offering_id = ?
       order by published_at is null, published_at desc, id desc`,
    )
    .all(userId, offeringId) as ClassroomFeedItem[];
}

export function isClassroomSyncFresh(
  userId: number,
  offeringId: number,
  ttlMinutes: number,
  now = Date.now(),
  connection: DatabaseConnection = getDatabase(),
): boolean {
  const state = getClassroomSyncState(userId, offeringId, connection);
  return Boolean(
    state?.lastSuccessfulSyncAt &&
    now - state.lastSuccessfulSyncAt < ttlMinutes * 60_000,
  );
}

export async function syncClassroomSubject(
  userId: number,
  offeringId: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    includeHistory?: boolean;
  } = {},
): Promise<{ activities: number; feedItems: number }> {
  const ownerId = idSchema.parse(userId);
  const targetId = idSchema.parse(offeringId);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const integration = getOfferingGoogleIntegration(targetId, connection);
  if (!integration?.classroomCourseId) {
    throw new Error("Classroom course is not configured.");
  }
  const attemptAt = Date.now();
  connection.sqlite
    .prepare(
      `insert into classroom_sync_states
       (user_id, offering_id, last_attempt_at, updated_at)
       values (?, ?, ?, ?)
       on conflict(user_id, offering_id) do update set
         last_attempt_at = excluded.last_attempt_at,
         updated_at = excluded.updated_at`,
    )
    .run(ownerId, targetId, attemptAt, attemptAt);
  try {
    const activities = await syncClassroomActivities(ownerId, targetId, {
      connection,
      fetchImpl,
      includeHistory: options.includeHistory,
    });
    const [materials, announcements] = await Promise.all([
      listClassroomCourseMaterials(ownerId, integration.classroomCourseId, {
        connection,
        fetchImpl,
      }),
      listClassroomAnnouncements(ownerId, integration.classroomCourseId, {
        connection,
        fetchImpl,
      }),
    ]);
    const coursework = connection.sqlite
      .prepare(
        `select external_id as externalId, title, description as excerpt,
                external_url as externalUrl,
                coalesce(external_updated_at, updated_at) as publishedAt
         from activities
         where user_id = ? and offering_id = ? and external_source = 'classroom'`,
      )
      .all(ownerId, targetId) as Array<{
      externalId: string;
      title: string;
      excerpt: string | null;
      externalUrl: string | null;
      publishedAt: number | null;
    }>;
    const now = Date.now();
    connection.sqlite.transaction(() => {
      const upsert = connection.sqlite.prepare(
        `insert into classroom_feed_items
         (user_id, offering_id, type, external_id, title, excerpt,
          external_url, published_at, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         on conflict(user_id, offering_id, type, external_id) do update set
           title = excluded.title, excerpt = excluded.excerpt,
           external_url = excluded.external_url,
           published_at = excluded.published_at,
           updated_at = excluded.updated_at`,
      );
      for (const item of announcements) {
        upsert.run(
          ownerId,
          targetId,
          "announcement",
          item.id,
          shortExcerpt(item.text)?.slice(0, 120) || "Aviso do Classroom",
          shortExcerpt(item.text),
          item.alternateLink ?? null,
          item.updateTime ? Date.parse(item.updateTime) : null,
          now,
          now,
        );
      }
      for (const item of materials) {
        upsert.run(
          ownerId,
          targetId,
          "material",
          item.id,
          item.title,
          shortExcerpt(item.description),
          item.alternateLink ?? null,
          item.updateTime ? Date.parse(item.updateTime) : null,
          now,
          now,
        );
      }
      for (const item of coursework) {
        upsert.run(
          ownerId,
          targetId,
          "coursework",
          item.externalId,
          item.title,
          shortExcerpt(item.excerpt ?? undefined),
          item.externalUrl,
          item.publishedAt,
          now,
          now,
        );
      }
      connection.sqlite
        .prepare(
          `update classroom_sync_states set
             last_successful_sync_at = ?, last_error_code = null, updated_at = ?
           where user_id = ? and offering_id = ?`,
        )
        .run(now, now, ownerId, targetId);
    })();
    return {
      activities,
      feedItems: announcements.length + materials.length + coursework.length,
    };
  } catch (error) {
    connection.sqlite
      .prepare(
        `update classroom_sync_states set last_error_code = 'sync_failed',
           updated_at = ? where user_id = ? and offering_id = ?`,
      )
      .run(Date.now(), ownerId, targetId);
    throw error;
  }
}

export async function syncAllAccessibleClassrooms(
  userId: number,
  ttlMinutes: number,
  options: {
    connection?: DatabaseConnection;
    fetchImpl?: GoogleFetch;
    now?: number;
  } = {},
): Promise<ClassroomSyncAllResult[]> {
  const ownerId = idSchema.parse(userId);
  const ttl = z.number().int().min(1).max(1440).parse(ttlMinutes);
  const connection = options.connection ?? getDatabase();
  const fetchImpl = options.fetchImpl ?? fetch;
  const offerings = listUserSubjectOfferings(ownerId, connection);
  const mappings = new Map(
    listOfferingGoogleIntegrations(
      offerings.map(({ offeringId }) => offeringId),
      connection,
    ).map((mapping) => [mapping.offeringId, mapping]),
  );
  const results: ClassroomSyncAllResult[] = [];
  for (const offering of offerings) {
    if (!mappings.get(offering.offeringId)?.classroomCourseId) continue;
    if (
      isClassroomSyncFresh(
        ownerId,
        offering.offeringId,
        ttl,
        options.now ?? Date.now(),
        connection,
      )
    ) {
      results.push({
        offeringId: offering.offeringId,
        subjectName: offering.subjectName,
        status: "fresh",
      });
      continue;
    }
    try {
      const synced = await syncClassroomSubject(ownerId, offering.offeringId, {
        connection,
        fetchImpl,
      });
      results.push({
        offeringId: offering.offeringId,
        subjectName: offering.subjectName,
        status: "synced",
        activities: synced.activities,
      });
    } catch {
      results.push({
        offeringId: offering.offeringId,
        subjectName: offering.subjectName,
        status: "error",
      });
    }
  }
  return results;
}
