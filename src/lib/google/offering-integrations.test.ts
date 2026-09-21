import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getOfferingGoogleIntegration,
  updateOfferingGoogleIntegration,
} from "./offering-integrations";

function createUser(
  connection: DatabaseConnection,
  login: string,
  role: "admin" | "member" = "member",
) {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, 'hash', ?, 1, ?, ?, ?)`,
      )
      .run(login, login, role, now, now, now).lastInsertRowid,
  );
}

function createOffering(connection: DatabaseConnection) {
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (code, name) values ('P', 'Program')")
      .run().lastInsertRowid,
  );
  const cohortId = Number(
    connection.sqlite
      .prepare(
        "insert into cohorts (program_id, code, name) values (?, 'C', 'Cohort')",
      )
      .run(programId).lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (code, name) values ('S', 'Subject')")
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
        `insert into subject_offerings
         (subject_id, program_id, academic_period_id, status)
         values (?, ?, ?, 'active')`,
      )
      .run(subjectId, programId, periodId).lastInsertRowid,
  );
  return { programId, cohortId, offeringId };
}

describe("Google offering integrations", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("aceita apenas hosts oficiais exatos para Google Notebook", () => {
    const adminId = createUser(connection, "admin", "admin");
    const { offeringId } = createOffering(connection);
    for (const notebookUrl of [
      "https://notebook.google.com/notebook/current?authuser=1",
      "https://notebooklm.google.com/notebook/legacy",
      "https://gemini.google.com/app/example",
    ]) {
      updateOfferingGoogleIntegration(
        adminId,
        offeringId,
        {
          notebookUrl,
          classroomCourseId: "course-1",
          classroomCourseName: "Course",
        },
        connection,
      );
      expect(
        getOfferingGoogleIntegration(offeringId, connection),
      ).toMatchObject({ notebookUrl, classroomCourseId: "course-1" });
    }
    expect(() =>
      updateOfferingGoogleIntegration(
        adminId,
        offeringId,
        {
          notebookUrl: "https://notebooklm.google.com.evil.test/notebook",
          classroomCourseId: null,
          classroomCourseName: null,
        },
        connection,
      ),
    ).toThrow("Invalid Google Notebook URL.");
    for (const notebookUrl of [
      "javascript:alert(1)",
      "data:text/html,private",
      "https://notebook.google.com.evil.test/notebook",
      "https://notebook.google.com@evil.test/notebook",
      "https://user:password@notebook.google.com/notebook/example",
    ]) {
      expect(() =>
        updateOfferingGoogleIntegration(
          adminId,
          offeringId,
          {
            notebookUrl,
            classroomCourseId: null,
            classroomCourseName: null,
          },
          connection,
        ),
      ).toThrow("Invalid Google Notebook URL.");
    }
    expect(() =>
      updateOfferingGoogleIntegration(
        adminId,
        offeringId,
        {
          notebookUrl: "http://notebooklm.google.com/notebook",
          classroomCourseId: null,
          classroomCourseName: null,
        },
        connection,
      ),
    ).toThrow("Invalid Google Notebook URL.");
  });

  it("respeita scopes de Program e impede Curator/User de administrar ofertas", () => {
    const moderatorId = createUser(connection, "moderator");
    const curatorId = createUser(connection, "curator");
    const userId = createUser(connection, "user");
    const { programId, cohortId, offeringId } = createOffering(connection);
    connection.sqlite
      .prepare(
        "insert into moderator_program_scopes (user_id, program_id) values (?, ?)",
      )
      .run(moderatorId, programId);
    connection.sqlite
      .prepare(
        "insert into curator_cohort_scopes (user_id, cohort_id) values (?, ?)",
      )
      .run(curatorId, cohortId);

    expect(() =>
      updateOfferingGoogleIntegration(
        moderatorId,
        offeringId,
        {
          notebookUrl: "https://gemini.google.com/app/example",
          classroomCourseId: null,
          classroomCourseName: null,
        },
        connection,
      ),
    ).not.toThrow();
    for (const actorId of [curatorId, userId]) {
      expect(() =>
        updateOfferingGoogleIntegration(
          actorId,
          offeringId,
          {
            notebookUrl: null,
            classroomCourseId: null,
            classroomCourseName: null,
          },
          connection,
        ),
      ).toThrow("Forbidden.");
    }

    const outsideProgramId = Number(
      connection.sqlite
        .prepare("insert into programs (name) values ('Outside')")
        .run().lastInsertRowid,
    );
    const outsideSubjectId = Number(
      connection.sqlite
        .prepare("insert into subjects (name) values ('Outside Subject')")
        .run().lastInsertRowid,
    );
    const periodId = (
      connection.sqlite
        .prepare("select id from academic_periods limit 1")
        .get() as { id: number }
    ).id;
    const outsideOfferingId = Number(
      connection.sqlite
        .prepare(
          "insert into subject_offerings (subject_id, program_id, academic_period_id) values (?, ?, ?)",
        )
        .run(outsideSubjectId, outsideProgramId, periodId).lastInsertRowid,
    );
    expect(() =>
      updateOfferingGoogleIntegration(
        moderatorId,
        outsideOfferingId,
        {
          notebookUrl: null,
          classroomCourseId: "outside-course",
          classroomCourseName: "Outside",
        },
        connection,
      ),
    ).toThrow("Forbidden.");
  });
});
