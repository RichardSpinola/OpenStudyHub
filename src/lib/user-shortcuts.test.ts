import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import { createShortcut } from "./shortcuts";
import { getAcademicAuthority } from "./academic-authority";
import {
  createUserShortcut,
  deleteUserShortcut,
  listUserShortcuts,
  moveUserShortcut,
  reorderEnabledUserShortcuts,
  setUserShortcutEnabled,
  updateUserShortcut,
} from "./user-shortcuts";

function createTestUser(connection: DatabaseConnection, login: string): number {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values (?, ?, ?, 'member', 1, ?, ?, ?)`,
      )
      .run("Pessoa Teste", login, "hash-teste", now, now, now).lastInsertRowid,
  );
}

describe("atalhos pessoais", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
    createShortcut(
      { name: "Default A", url: "https://a.example.test", icon: "A" },
      connection,
    );
    createShortcut(
      { name: "Default B", url: "https://b.example.test", icon: "B" },
      connection,
    );
  });

  afterEach(() => connection.close());

  it("copia os defaults uma única vez e permite lista pessoal vazia", () => {
    const userId = createTestUser(connection, "pessoa.vazia");
    const initialized = listUserShortcuts(userId, connection);
    expect(initialized.map(({ name }) => name)).toEqual([
      "Default A",
      "Default B",
    ]);

    initialized.forEach(({ id }) => deleteUserShortcut(userId, id, connection));
    createShortcut(
      { name: "Default posterior", url: "https://later.example.test" },
      connection,
    );

    expect(listUserShortcuts(userId, connection)).toEqual([]);
    expect(
      connection.sqlite
        .prepare(
          "select shortcuts_initialized as initialized from users where id = ?",
        )
        .get(userId),
    ).toEqual({ initialized: 1 });
  });

  it("mantém listas independentes para dois usuários", () => {
    const firstId = createTestUser(connection, "primeira.pessoa");
    const secondId = createTestUser(connection, "segunda.pessoa");
    const firstShortcut = listUserShortcuts(firstId, connection)[0];
    const secondShortcut = listUserShortcuts(secondId, connection)[0];

    updateUserShortcut(
      firstId,
      firstShortcut.id,
      { name: "Somente primeira", url: "https://first.example.test" },
      connection,
    );

    expect(listUserShortcuts(firstId, connection)[0]?.name).toBe(
      "Somente primeira",
    );
    expect(listUserShortcuts(secondId, connection)[0]?.name).toBe("Default A");
    expect(() =>
      updateUserShortcut(
        firstId,
        secondShortcut.id,
        { name: "Inválido", url: "https://invalid.example.test" },
        connection,
      ),
    ).toThrow("Atalho não encontrado.");
  });

  it("persiste criação, remoção e ordenação por usuário", () => {
    const userId = createTestUser(connection, "pessoa.ordem");
    const initial = listUserShortcuts(userId, connection);
    const created = createUserShortcut(
      userId,
      { name: "Pessoal", url: "https://personal.example.test" },
      connection,
    );

    reorderEnabledUserShortcuts(
      userId,
      [created.id, initial[1].id, initial[0].id],
      connection,
    );
    expect(listUserShortcuts(userId, connection).map(({ id }) => id)).toEqual([
      created.id,
      initial[1].id,
      initial[0].id,
    ]);

    deleteUserShortcut(userId, initial[1].id, connection);
    expect(listUserShortcuts(userId, connection).map(({ id }) => id)).toEqual([
      created.id,
      initial[0].id,
    ]);
  });

  it("recusa reordenação com atalhos de outro usuário", () => {
    const firstId = createTestUser(connection, "primeira.ordem");
    const secondId = createTestUser(connection, "segunda.ordem");
    const first = listUserShortcuts(firstId, connection);
    const second = listUserShortcuts(secondId, connection);

    expect(() =>
      reorderEnabledUserShortcuts(
        firstId,
        [first[0].id, second[1].id],
        connection,
      ),
    ).toThrow("Ordenação de atalhos inválida.");
  });

  it("preserva atalhos ao trocar entre ADMIN, MODERATOR, CURATOR e USER", () => {
    const adminId = createTestUser(connection, "admin.shortcuts");
    const moderatorId = createTestUser(connection, "moderator.shortcuts");
    const curatorId = createTestUser(connection, "curator.shortcuts");
    const userId = createTestUser(connection, "user.shortcuts");
    connection.sqlite
      .prepare("update users set role = 'admin' where id = ?")
      .run(adminId);
    const programId = Number(
      connection.sqlite
        .prepare("insert into programs (name) values ('Programa')")
        .run().lastInsertRowid,
    );
    const cohortId = Number(
      connection.sqlite
        .prepare("insert into cohorts (program_id, name) values (?, 'Turma')")
        .run(programId).lastInsertRowid,
    );
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

    for (const [id, expectedRole] of [
      [adminId, "admin"],
      [moderatorId, "moderator"],
      [curatorId, "curator"],
      [userId, "user"],
    ] as const) {
      const shortcut = createUserShortcut(
        id,
        {
          name: `${expectedRole} privado`,
          url: "https://hub.example.test/admin",
        },
        connection,
      );
      expect(getAcademicAuthority(id, connection).role).toBe(expectedRole);
      expect(listUserShortcuts(id, connection)).toContainEqual(shortcut);
    }

    const before = listUserShortcuts(moderatorId, connection).map(
      ({ id }) => id,
    );
    connection.sqlite
      .prepare("delete from moderator_program_scopes where user_id = ?")
      .run(moderatorId);
    expect(getAcademicAuthority(moderatorId, connection).role).toBe("user");
    expect(
      listUserShortcuts(moderatorId, connection).map(({ id }) => id),
    ).toEqual(before);
  });

  it("mantém ordenação consistente entre drag-and-drop, setas e itens desativados", () => {
    const userId = createTestUser(connection, "pessoa.controles");
    const initial = listUserShortcuts(userId, connection);
    const third = createUserShortcut(
      userId,
      { name: "Terceiro", url: "https://third.example.test" },
      connection,
    );
    setUserShortcutEnabled(userId, initial[1].id, false, connection);
    reorderEnabledUserShortcuts(userId, [third.id, initial[0].id], connection);
    moveUserShortcut(userId, initial[1].id, "up", connection);

    expect(listUserShortcuts(userId, connection).map(({ id }) => id)).toEqual([
      initial[1].id,
      third.id,
      initial[0].id,
    ]);
  });
});
