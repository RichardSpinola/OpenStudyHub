import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getClassroomCourse,
  getClassroomSyncState,
  isClassroomSyncFresh,
  listClassroomFeedItems,
  listClassroomCourses,
  syncClassroomActivities,
  syncAllAccessibleClassrooms,
  syncClassroomSubject,
} from "./classroom";
import { getGoogleAccessToken } from "./oauth";

vi.mock("./oauth", () => ({
  getGoogleAccessToken: vi.fn(async () => "access-token"),
}));

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const userId = Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('User', 'user', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
  const otherUserId = Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Other', 'other', 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Program')")
      .run().lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name) values ('Subject')")
      .run().lastInsertRowid,
  );
  const periodId = Number(
    connection.sqlite
      .prepare(
        "insert into academic_periods (label, starts_on, ends_on) values ('2030.1', '2030-01-01', '2030-06-30')",
      )
      .run().lastInsertRowid,
  );
  const offeringId = Number(
    connection.sqlite
      .prepare(
        "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
      )
      .run(subjectId, programId, periodId).lastInsertRowid,
  );
  connection.sqlite
    .prepare("insert into enrollments (user_id, offering_id) values (?, ?)")
    .run(userId, offeringId);
  connection.sqlite
    .prepare(
      `insert into offering_google_integrations
       (offering_id, classroom_course_id, classroom_course_name)
       values (?, 'course-1', 'Course')`,
    )
    .run(offeringId);
  return { userId, otherUserId, offeringId };
}

describe("Classroom read-only sync", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    vi.mocked(getGoogleAccessToken).mockClear();
  });

  afterEach(() => connection.close());

  it("lista cursos acessíveis e valida um mapping pelo curso real", async () => {
    const { userId } = seed(connection);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/courses/course-1")) {
        return Response.json({ id: "course-1", name: "Course One" });
      }
      return Response.json({
        courses: [
          { id: "course-1", name: "Course One", courseState: "ACTIVE" },
        ],
      });
    });

    await expect(
      listClassroomCourses(userId, { connection, fetchImpl }),
    ).resolves.toEqual([
      { id: "course-1", name: "Course One", courseState: "ACTIVE" },
    ]);
    await expect(
      getClassroomCourse(userId, "course-1", { connection, fetchImpl }),
    ).resolves.toEqual({ id: "course-1", name: "Course One" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retorna falha controlada quando Classroom restringe a conta", async () => {
    const { userId } = seed(connection);
    await expect(
      listClassroomCourses(userId, {
        connection,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          Response.json({}, { status: 403 }),
        ),
      }),
    ).rejects.toThrow("Classroom read failed.");
  });

  it("sincroniza idempotentemente com GET e usa a conexão do próprio usuário", async () => {
    const { userId, offeringId } = seed(connection);
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.method).toBe("GET");
      const url = String(input);
      if (url.includes("studentSubmissions")) {
        return Response.json({
          studentSubmissions: [{ courseWorkId: "work-1", state: "TURNED_IN" }],
        });
      }
      return Response.json({
        courseWork: [
          {
            id: "work-1",
            title: "Assignment",
            description: "Read only",
            alternateLink: "https://classroom.google.com/c/example/a/example",
            updateTime: "2030-02-01T10:00:00Z",
            dueDate: { year: 2030, month: 2, day: 10 },
            dueTime: { hours: 9, minutes: 30 },
          },
        ],
      });
    });

    await syncClassroomActivities(userId, offeringId, {
      connection,
      fetchImpl,
    });
    await syncClassroomActivities(userId, offeringId, {
      connection,
      fetchImpl,
    });

    expect(getGoogleAccessToken).toHaveBeenCalledWith(userId, {
      connection,
      fetchImpl,
    });
    expect(
      connection.sqlite
        .prepare(
          `select count(*) as count, status, origin,
                  external_source as externalSource
           from activities where user_id = ?`,
        )
        .get(userId),
    ).toEqual({
      count: 1,
      status: "submitted",
      origin: "external",
      externalSource: "classroom",
    });
  });

  it("limita o sync ao período atual e só importa histórico quando solicitado", async () => {
    const { userId, offeringId } = seed(connection);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("studentSubmissions")) {
        return Response.json({ studentSubmissions: [] });
      }
      return Response.json({
        courseWork: [
          {
            id: "current-work",
            title: "Atividade atual",
            creationTime: "2030-02-01T10:00:00Z",
          },
          {
            id: "old-work",
            title: "Atividade antiga",
            creationTime: "2029-11-01T10:00:00Z",
          },
        ],
      });
    });

    await expect(
      syncClassroomActivities(userId, offeringId, { connection, fetchImpl }),
    ).resolves.toBe(1);
    expect(
      connection.sqlite
        .prepare("select title from activities order by title")
        .all(),
    ).toEqual([{ title: "Atividade atual" }]);

    await expect(
      syncClassroomActivities(userId, offeringId, {
        connection,
        fetchImpl,
        includeHistory: true,
      }),
    ).resolves.toBe(2);
    expect(
      connection.sqlite
        .prepare("select title from activities order by title")
        .all(),
    ).toEqual([{ title: "Atividade antiga" }, { title: "Atividade atual" }]);
  });

  it("bloqueia usuário sem matrícula antes de acessar Google", async () => {
    const { otherUserId, offeringId } = seed(connection);
    await expect(
      syncClassroomActivities(otherUserId, offeringId, {
        connection,
        fetchImpl: vi.fn<typeof fetch>(),
      }),
    ).rejects.toThrow("Offering is outside the user's academic context.");
    expect(getGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("solicita sempre o token do usuário que iniciou a própria sincronização", async () => {
    const { otherUserId, offeringId } = seed(connection);
    connection.sqlite
      .prepare("insert into enrollments (user_id, offering_id) values (?, ?)")
      .run(otherUserId, offeringId);
    const fetchImpl = vi.fn<typeof fetch>(async (input) =>
      Response.json(
        String(input).includes("studentSubmissions")
          ? { studentSubmissions: [] }
          : { courseWork: [] },
      ),
    );

    await syncClassroomActivities(otherUserId, offeringId, {
      connection,
      fetchImpl,
    });

    expect(getGoogleAccessToken).toHaveBeenCalledWith(otherUserId, {
      connection,
      fetchImpl,
    });
  });

  it("mantém cache temporal do Mural e respeita freshness", async () => {
    const { userId, offeringId } = seed(connection);
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("studentSubmissions")) {
        return Response.json({ studentSubmissions: [] });
      }
      if (url.includes("courseWorkMaterials")) {
        return Response.json({
          courseWorkMaterial: [
            {
              id: "material-1",
              title: "Slides",
              description: "Material resumido",
              updateTime: "2030-02-02T10:00:00Z",
            },
          ],
        });
      }
      if (url.includes("announcements")) {
        return Response.json({
          announcements: [
            {
              id: "announcement-1",
              text: "Aviso para a turma",
              updateTime: "2030-02-03T10:00:00Z",
            },
          ],
        });
      }
      return Response.json({
        courseWork: [{ id: "work-1", title: "Trabalho" }],
      });
    });

    await syncClassroomSubject(userId, offeringId, {
      connection,
      fetchImpl,
    });
    expect(listClassroomFeedItems(userId, offeringId, connection)).toHaveLength(
      3,
    );
    expect(getClassroomSyncState(userId, offeringId, connection)).toMatchObject(
      {
        lastErrorCode: null,
      },
    );
    expect(
      isClassroomSyncFresh(userId, offeringId, 15, Date.now(), connection),
    ).toBe(true);
  });

  it("preserva cache local quando uma sincronização falha", async () => {
    const { userId, offeringId } = seed(connection);
    connection.sqlite
      .prepare(
        `insert into classroom_feed_items
         (user_id, offering_id, type, external_id, title)
         values (?, ?, 'announcement', 'cached', 'Aviso em cache')`,
      )
      .run(userId, offeringId);
    await expect(
      syncClassroomSubject(userId, offeringId, {
        connection,
        fetchImpl: vi.fn<typeof fetch>(async () =>
          Response.json({}, { status: 503 }),
        ),
      }),
    ).rejects.toThrow();
    expect(
      listClassroomFeedItems(userId, offeringId, connection)[0].title,
    ).toBe("Aviso em cache");
    expect(
      getClassroomSyncState(userId, offeringId, connection)?.lastErrorCode,
    ).toBe("sync_failed");
  });

  it("Sync All usa mappings acessíveis, respeita TTL e relata falha por matéria", async () => {
    const { userId, offeringId } = seed(connection);
    const failingFetch = vi.fn<typeof fetch>(async () =>
      Response.json({}, { status: 503 }),
    );
    await expect(
      syncAllAccessibleClassrooms(userId, 15, {
        connection,
        fetchImpl: failingFetch,
      }),
    ).resolves.toEqual([
      {
        offeringId,
        subjectName: "Subject",
        status: "error",
      },
    ]);

    const now = Date.now();
    connection.sqlite
      .prepare(
        `update classroom_sync_states set last_successful_sync_at = ?, updated_at = ?
         where user_id = ? and offering_id = ?`,
      )
      .run(now, now, userId, offeringId);
    await expect(
      syncAllAccessibleClassrooms(userId, 15, {
        connection,
        fetchImpl: failingFetch,
        now,
      }),
    ).resolves.toEqual([
      {
        offeringId,
        subjectName: "Subject",
        status: "fresh",
      },
    ]);
  });
});
