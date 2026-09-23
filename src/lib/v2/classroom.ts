import type { V2Database } from "./database";
import { googleAccessTokenV2, googleConnectionStatus } from "./google-oauth";

export type Course = { id: string; name: string; section?: string };
export type FeedItem = {
  id: string;
  title: string;
  link?: string;
  publishedAt?: string;
};
export interface ClassroomAdapter {
  listCourses(userId: number): Promise<Course[]>;
  listFeed(userId: number, courseId: string): Promise<FeedItem[]>;
}

type GoogleFetch = typeof fetch;
async function classroomPage<T>(
  token: string,
  path: string,
  fetchImpl: GoogleFetch,
): Promise<T[]> {
  const results: T[] = [];
  let next: string | undefined;
  do {
    const url = new URL("https://classroom.googleapis.com/v1/" + path);
    url.searchParams.set("pageSize", "100");
    if (next) url.searchParams.set("pageToken", next);
    const response = await fetchImpl(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const error = new Error(
        response.status === 429 ? "rate_limit" : "classroom_unavailable",
      );
      throw error;
    }
    const body = (await response.json()) as {
      courses?: T[];
      courseWork?: T[];
      courseWorkMaterials?: T[];
      announcements?: T[];
      nextPageToken?: string;
    };
    results.push(
      ...(body.courses ??
        body.courseWork ??
        body.courseWorkMaterials ??
        body.announcements ??
        []),
    );
    next = body.nextPageToken;
    if (results.length > 1000) throw new Error("classroom_limit");
  } while (next);
  return results;
}
const text = (value: unknown, max = 255) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const safeLink = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export class GoogleClassroomAdapter implements ClassroomAdapter {
  constructor(
    private readonly db: V2Database,
    private readonly fetchImpl: GoogleFetch = fetch,
    private readonly token: (
      db: V2Database,
      userId: number,
    ) => Promise<string> = googleAccessTokenV2,
  ) {}
  async listCourses(userId: number): Promise<Course[]> {
    const access = await this.token(this.db, userId);
    const rows = await classroomPage<{
      id?: string;
      name?: string;
      section?: string;
    }>(access, "courses?courseStates=ACTIVE", this.fetchImpl);
    return rows
      .filter((row) => !!row.id && !!row.name)
      .map((row) => ({
        id: text(row.id, 128),
        name: text(row.name),
        section: text(row.section) || undefined,
      }));
  }
  async listFeed(userId: number, courseId: string): Promise<FeedItem[]> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(courseId))
      throw new Error("Classroom inválido.");
    const access = await this.token(this.db, userId);
    const parts = await Promise.all([
      classroomPage<{
        id?: string;
        title?: string;
        alternateLink?: string;
        creationTime?: string;
      }>(access, `courses/${courseId}/courseWork`, this.fetchImpl),
      classroomPage<{
        id?: string;
        title?: string;
        alternateLink?: string;
        creationTime?: string;
      }>(access, `courses/${courseId}/courseWorkMaterials`, this.fetchImpl),
      classroomPage<{
        id?: string;
        text?: string;
        alternateLink?: string;
        creationTime?: string;
      }>(access, `courses/${courseId}/announcements`, this.fetchImpl),
    ]);
    return parts.flatMap((rows, index) =>
      rows
        .filter((row) => !!row.id)
        .map((row) => ({
          id: `${index}:${text(row.id, 128)}`,
          title:
            text("title" in row ? row.title : "text" in row ? row.text : "") ||
            "Sem título",
          link: safeLink(row.alternateLink),
          publishedAt: text(row.creationTime, 40) || undefined,
        })),
    );
  }
}

export function eligibleOfferings(db: V2Database, userId: number) {
  return db
    .prepare(
      `SELECT o.id offeringId,s.name subjectName,s.code subjectCode,o.class_group classGroup,
      i.name instructorName
     FROM enrollments e JOIN offerings o ON o.id=e.offering_id
     JOIN subjects s ON s.id=o.subject_id LEFT JOIN instructors i ON i.id=o.instructor_id
     WHERE e.user_id=? AND e.withdrawn_at IS NULL AND o.archived_at IS NULL
       AND o.state IN ('planned','active') ORDER BY s.name,o.id`,
    )
    .all(userId) as Array<{
    offeringId: number;
    subjectName: string;
    subjectCode: string | null;
    classGroup: string | null;
    instructorName: string | null;
  }>;
}

export async function discoverClassrooms(
  db: V2Database,
  userId: number,
  adapter: ClassroomAdapter,
): Promise<Course[]> {
  if (googleConnectionStatus(db, userId)?.status !== "connected")
    throw new Error("Conecte sua conta Google.");
  const courses = await adapter.listCourses(userId);
  const unique = new Set<string>();
  const accepted: Course[] = [];
  db.transaction(() => {
    db.prepare("DELETE FROM classroom_courses_v2 WHERE user_id=?").run(userId);
    for (const course of courses) {
      if (
        !/^[A-Za-z0-9_-]{1,128}$/.test(course.id) ||
        !course.name?.trim() ||
        unique.has(course.id)
      )
        continue;
      unique.add(course.id);
      const safe = {
        id: course.id,
        name: text(course.name),
        section: text(course.section) || undefined,
      };
      accepted.push(safe);
      db.prepare(
        "INSERT INTO classroom_courses_v2(user_id,course_id,name,section,fetched_at) VALUES(?,?,?,?,?)",
      ).run(userId, safe.id, safe.name, safe.section ?? null, Date.now());
    }
  })();
  return accepted;
}

const normal = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function suggestClassrooms(db: V2Database, userId: number) {
  const courses = db
    .prepare(
      "SELECT course_id id,name,section FROM classroom_courses_v2 WHERE user_id=? ORDER BY name,course_id",
    )
    .all(userId) as Course[];
  const mapped = new Set(
    (
      db
        .prepare(
          "SELECT course_id id FROM user_classroom_mappings WHERE user_id=?",
        )
        .all(userId) as Array<{ id: string }>
    ).map((row) => row.id),
  );
  return eligibleOfferings(db, userId).map((offering) => {
    const subject = normal(offering.subjectName);
    const code = offering.subjectCode && normal(offering.subjectCode);
    const ranked = courses
      .filter((course) => !mapped.has(course.id))
      .map((course) => {
        const name = normal(course.name);
        let score =
          name === subject
            ? 100
            : name.includes(subject) && subject.length > 3
              ? 55
              : 0;
        let reason =
          score === 100 ? "Nome exato" : score ? "Nome contém disciplina" : "";
        if (code && name.includes(code)) {
          score += 30;
          reason += reason ? " + código" : "Código";
        }
        if (
          offering.classGroup &&
          normal(course.section ?? "") === normal(offering.classGroup)
        ) {
          score += 10;
          reason += reason ? " + turma" : "Turma";
        }
        return { course, score, reason };
      })
      .filter((candidate) => candidate.score >= 50)
      .sort(
        (a, b) => b.score - a.score || a.course.id.localeCompare(b.course.id),
      );
    const top = ranked[0];
    return {
      ...offering,
      suggestion:
        top && (ranked.length === 1 || top.score > ranked[1].score)
          ? {
              courseId: top.course.id,
              courseName: top.course.name,
              confidence: top.score >= 100 ? "alta" : "moderada",
              reason: top.reason,
            }
          : null,
      ambiguous: !!top && ranked.length > 1 && top.score === ranked[1].score,
    };
  });
}

export function parseClassroomAssignments(form: FormData) {
  const assignments: Array<{ offeringId: number; courseId: string }> = [];
  for (const [key, value] of form.entries()) {
    const match = /^mapping-(\d+)$/.exec(key);
    if (match && typeof value === "string")
      assignments.push({ offeringId: Number(match[1]), courseId: value });
  }
  return assignments;
}

export function confirmClassrooms(
  db: V2Database,
  userId: number,
  assignments: Array<{ offeringId: number; courseId: string }>,
): void {
  if (assignments.length > 100) throw new Error("Lote grande demais.");
  const eligible = new Set(
    eligibleOfferings(db, userId).map((row) => row.offeringId),
  );
  const seenOffering = new Set<number>();
  for (const item of assignments) {
    if (!eligible.has(item.offeringId) || seenOffering.has(item.offeringId))
      throw new Error("Associação duplicada ou sem permissão.");
    if (
      item.courseId &&
      !db
        .prepare(
          "SELECT 1 FROM classroom_courses_v2 WHERE user_id=? AND course_id=?",
        )
        .get(userId, item.courseId)
    )
      throw new Error("Classroom não descoberto por este usuário.");
    seenOffering.add(item.offeringId);
  }
  db.transaction(() => {
    for (const item of assignments) {
      if (!item.courseId) {
        db.prepare(
          "DELETE FROM user_classroom_mappings WHERE user_id=? AND offering_id=?",
        ).run(userId, item.offeringId);
        db.prepare(
          "DELETE FROM classroom_feed_v2 WHERE user_id=? AND offering_id=?",
        ).run(userId, item.offeringId);
        db.prepare(
          "DELETE FROM classroom_sync_v2 WHERE user_id=? AND offering_id=?",
        ).run(userId, item.offeringId);
        continue;
      }
      const course = db
        .prepare(
          "SELECT name FROM classroom_courses_v2 WHERE user_id=? AND course_id=?",
        )
        .get(userId, item.courseId) as { name: string };
      const previous = db
        .prepare(
          "SELECT course_id id FROM user_classroom_mappings WHERE user_id=? AND offering_id=?",
        )
        .get(userId, item.offeringId) as { id: string } | undefined;
      db.prepare(
        `INSERT INTO user_classroom_mappings(user_id,offering_id,course_id,course_name,confirmed_at)
         VALUES(?,?,?,?,?) ON CONFLICT(user_id,offering_id) DO UPDATE SET
         course_id=excluded.course_id,course_name=excluded.course_name,
         confirmed_at=excluded.confirmed_at`,
      ).run(userId, item.offeringId, item.courseId, course.name, Date.now());
      if (previous?.id !== item.courseId) {
        db.prepare(
          "DELETE FROM classroom_feed_v2 WHERE user_id=? AND offering_id=?",
        ).run(userId, item.offeringId);
        db.prepare(
          "DELETE FROM classroom_sync_v2 WHERE user_id=? AND offering_id=?",
        ).run(userId, item.offeringId);
      }
    }
  })();
}

export function classroomCache(
  db: V2Database,
  userId: number,
  offeringId: number,
) {
  const state = db
    .prepare(
      "SELECT status,last_attempt_at attempt,last_success_at success,error_code error FROM classroom_sync_v2 WHERE user_id=? AND offering_id=?",
    )
    .get(userId, offeringId) as
    | {
        status: string;
        attempt: number | null;
        success: number | null;
        error: string | null;
      }
    | undefined;
  const items = db
    .prepare(
      "SELECT external_id id,title,link,published_at publishedAt FROM classroom_feed_v2 WHERE user_id=? AND offering_id=? ORDER BY published_at DESC LIMIT 100",
    )
    .all(userId, offeringId) as FeedItem[];
  return {
    state: state ?? {
      status: "idle",
      attempt: null,
      success: null,
      error: null,
    },
    items,
  };
}

export async function syncClassroom(
  db: V2Database,
  userId: number,
  offeringId: number,
  adapter: ClassroomAdapter,
  force = false,
  now = Date.now(),
  ttl = 15 * 60_000,
): Promise<
  "fresh" | "updated" | "busy" | "error" | "needs_reconnect" | "superseded"
> {
  if (
    !eligibleOfferings(db, userId).some((row) => row.offeringId === offeringId)
  )
    throw new Error("Oferta sem acesso.");
  const mapping = db
    .prepare(
      "SELECT course_id id FROM user_classroom_mappings WHERE user_id=? AND offering_id=?",
    )
    .get(userId, offeringId) as { id: string } | undefined;
  if (!mapping) throw new Error("Confirme um Classroom primeiro.");
  const connection = googleConnectionStatus(db, userId);
  if (connection?.status !== "connected") return "needs_reconnect";
  const previous = classroomCache(db, userId, offeringId).state;
  if (!force && previous.success && now - previous.success < ttl)
    return "fresh";
  if (
    previous.status === "updating" &&
    previous.attempt &&
    now - previous.attempt < 60_000
  )
    return "busy";
  if (
    !force &&
    previous.status === "error" &&
    previous.attempt &&
    now - previous.attempt < 60_000
  )
    return "busy";
  db.prepare(
    `INSERT INTO classroom_sync_v2(user_id,offering_id,last_attempt_at,status)
     VALUES(?, ?, ?, 'updating') ON CONFLICT(user_id,offering_id)
     DO UPDATE SET last_attempt_at=excluded.last_attempt_at,status='updating',error_code=NULL`,
  ).run(userId, offeringId, now);
  try {
    const feed = (await adapter.listFeed(userId, mapping.id))
      .filter((item) => typeof item.id === "string" && item.id.length <= 255)
      .slice(0, 500)
      .map((item) => ({
        id: item.id,
        title: text(item.title) || "Sem título",
        link: safeLink(item.link),
        publishedAt: text(item.publishedAt, 40) || undefined,
      }));
    const applied = db.transaction(() => {
      const current = db
        .prepare(
          "SELECT course_id id FROM user_classroom_mappings WHERE user_id=? AND offering_id=?",
        )
        .get(userId, offeringId) as { id: string } | undefined;
      if (current?.id !== mapping.id) return false;
      db.prepare(
        "DELETE FROM classroom_feed_v2 WHERE user_id=? AND offering_id=?",
      ).run(userId, offeringId);
      const insert = db.prepare(
        "INSERT INTO classroom_feed_v2(user_id,offering_id,external_id,title,link,published_at) VALUES(?,?,?,?,?,?)",
      );
      for (const item of feed)
        insert.run(
          userId,
          offeringId,
          item.id,
          item.title,
          item.link ?? null,
          item.publishedAt ?? null,
        );
      db.prepare(
        "UPDATE classroom_sync_v2 SET status='ready',last_success_at=?,error_code=NULL WHERE user_id=? AND offering_id=?",
      ).run(now, userId, offeringId);
      return true;
    })();
    return applied ? "updated" : "superseded";
  } catch (error) {
    const reconnect =
      googleConnectionStatus(db, userId)?.status === "needs_reconnect";
    const code = reconnect
      ? "reconnect"
      : error instanceof Error && error.message === "rate_limit"
        ? "rate_limit"
        : "unavailable";
    db.prepare(
      "UPDATE classroom_sync_v2 SET status=?,error_code=? WHERE user_id=? AND offering_id=?",
    ).run(reconnect ? "needs_reconnect" : "error", code, userId, offeringId);
    return reconnect ? "needs_reconnect" : "error";
  }
}
