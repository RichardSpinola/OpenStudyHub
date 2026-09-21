import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import { exportNoteAsHtml, exportNoteAsMarkdown } from "./note-export";
import {
  createNote,
  deleteNote,
  getUserNote,
  listUserNotes,
  updateNote,
} from "./notes";

function seed(connection: DatabaseConnection) {
  const now = Date.now();
  const createUser = connection.sqlite.prepare(
    `insert into users
     (display_name, login, password_hash, role, active,
      password_changed_at, created_at, updated_at)
     values (?, ?, 'hash', 'member', 1, ?, ?, ?)`,
  );
  const ownerId = Number(
    createUser.run("Pessoa A", "pessoa-a", now, now, now).lastInsertRowid,
  );
  const otherId = Number(
    createUser.run("Pessoa B", "pessoa-b", now, now, now).lastInsertRowid,
  );
  const programId = Number(
    connection.sqlite
      .prepare("insert into programs (name) values ('Programa')")
      .run().lastInsertRowid,
  );
  const subjectId = Number(
    connection.sqlite
      .prepare("insert into subjects (name) values ('Algoritmos')")
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
    .run(ownerId, offeringId);
  const activityId = Number(
    connection.sqlite
      .prepare(
        "insert into activities (user_id, offering_id, title) values (?, ?, 'Lista 1')",
      )
      .run(ownerId, offeringId).lastInsertRowid,
  );
  return { ownerId, otherId, offeringId, activityId };
}

describe("notas pessoais", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("cria, associa, edita, busca e remove somente pelo proprietário", () => {
    const { ownerId, otherId, offeringId, activityId } = seed(connection);
    const created = createNote(
      ownerId,
      {
        title: "Revisão de estruturas",
        content: "pilha e fila",
        offeringId,
        activityId,
      },
      connection,
    );

    expect(created).toMatchObject({
      subjectName: "Algoritmos",
      activityTitle: "Lista 1",
    });
    expect(listUserNotes(ownerId, "FILA", connection)).toHaveLength(1);
    expect(listUserNotes(ownerId, "%", connection)).toHaveLength(0);
    expect(() => getUserNote(otherId, created.id, connection)).toThrow(
      "Note not found.",
    );
    expect(() =>
      updateNote(
        otherId,
        created.id,
        { title: "Inválida", content: "", offeringId: null, activityId: null },
        connection,
      ),
    ).toThrow("Note not found.");

    const updated = updateNote(
      ownerId,
      created.id,
      { title: "Revisão final", content: "conteúdo", offeringId, activityId },
      connection,
    );
    expect(updated.title).toBe("Revisão final");
    expect(() => deleteNote(otherId, created.id, connection)).toThrow(
      "Note not found.",
    );
    deleteNote(ownerId, created.id, connection);
    expect(listUserNotes(ownerId, "", connection)).toEqual([]);
  });

  it("recusa associações fora da matrícula ou pertencentes a outra pessoa", () => {
    const { otherId, offeringId, activityId } = seed(connection);
    expect(() =>
      createNote(
        otherId,
        { title: "Fora", content: "", offeringId, activityId: null },
        connection,
      ),
    ).toThrow("outside the user's academic context");
    expect(() =>
      createNote(
        otherId,
        { title: "Atividade alheia", content: "", activityId },
        connection,
      ),
    ).toThrow("Activity not found.");
  });

  it("exporta Markdown e HTML portátil sem interpretar conteúdo como HTML", () => {
    const { ownerId } = seed(connection);
    const note = createNote(
      ownerId,
      {
        title: "Notas <script>",
        content: "**texto**\n<script>alert(1)</script>",
      },
      connection,
    );

    expect(exportNoteAsMarkdown(note)).toContain("**texto**");
    const html = exportNoteAsHtml(note);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
