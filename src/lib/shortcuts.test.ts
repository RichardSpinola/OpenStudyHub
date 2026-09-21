import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";

import {
  addDemoShortcuts,
  createShortcut,
  deleteShortcut,
  listEnabledShortcuts,
  listShortcuts,
  moveShortcut,
  reorderEnabledShortcuts,
  reorderShortcuts,
  setShortcutEnabled,
  updateShortcut,
} from "./shortcuts";

describe("atalhos persistentes", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
    connection.sqlite.exec(`
      create table shortcuts (
        id integer primary key autoincrement not null,
        name text not null,
        url text not null,
        icon text,
        icon_storage_name text,
        icon_mime_type text,
        sort_order integer default 0 not null,
        enabled integer default 1 not null,
        created_at integer not null,
        updated_at integer not null
      );
    `);
  });

  afterEach(() => connection.close());

  it("cria, edita, desabilita e remove um atalho", () => {
    const created = createShortcut(
      { name: "Docs", url: "https://docs.example.test", icon: "DOC" },
      connection,
    );
    const edited = updateShortcut(
      created.id,
      { name: "Documentos", url: "https://docs.example.test/new" },
      connection,
    );

    expect(edited.name).toBe("Documentos");
    expect(setShortcutEnabled(created.id, false, connection).enabled).toBe(
      false,
    );
    expect(listEnabledShortcuts(connection)).toHaveLength(0);

    deleteShortcut(created.id, connection);
    expect(listShortcuts(connection)).toHaveLength(0);
  });

  it("reordena atalhos e mantém os dados na mesma conexão", () => {
    const first = createShortcut(
      { name: "Primeiro", url: "https://one.example.test" },
      connection,
    );
    const second = createShortcut(
      { name: "Segundo", url: "https://two.example.test" },
      connection,
    );

    moveShortcut(second.id, "up", connection);

    expect(listShortcuts(connection).map(({ id }) => id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("persiste uma ordenação completa produzida por drag-and-drop", () => {
    const first = createShortcut(
      { name: "Primeiro", url: "https://one.example.test" },
      connection,
    );
    const second = createShortcut(
      { name: "Segundo", url: "https://two.example.test" },
      connection,
    );
    const third = createShortcut(
      { name: "Terceiro", url: "https://three.example.test" },
      connection,
    );

    reorderShortcuts([third.id, first.id, second.id], connection);

    expect(listShortcuts(connection).map(({ id }) => id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
  });

  it("recusa uma ordenação que não corresponda aos atalhos persistidos", () => {
    const shortcut = createShortcut(
      { name: "Único", url: "https://only.example.test" },
      connection,
    );

    expect(() => reorderShortcuts([shortcut.id, 999], connection)).toThrow(
      "Ordenação de atalhos inválida.",
    );
  });

  it("reordena somente atalhos ativos sem deslocar um item desabilitado", () => {
    const first = createShortcut(
      { name: "Primeiro", url: "https://one.example.test" },
      connection,
    );
    const disabled = createShortcut(
      { name: "Desativado", url: "https://off.example.test" },
      connection,
    );
    const third = createShortcut(
      { name: "Terceiro", url: "https://three.example.test" },
      connection,
    );
    setShortcutEnabled(disabled.id, false, connection);

    reorderEnabledShortcuts([third.id, first.id], connection);

    expect(listShortcuts(connection).map(({ id }) => id)).toEqual([
      third.id,
      disabled.id,
      first.id,
    ]);
  });

  it("mantém atalhos após fechar e reabrir o banco", () => {
    const directory = mkdtempSync(join(tmpdir(), "openstudyhub-shortcuts-"));
    const databasePath = join(directory, "phase-one.db");
    let persistentConnection = createDatabase(databasePath);

    try {
      persistentConnection.sqlite.exec(`
        create table shortcuts (
          id integer primary key autoincrement not null,
          name text not null,
          url text not null,
          icon text,
          icon_storage_name text,
          icon_mime_type text,
          sort_order integer default 0 not null,
          enabled integer default 1 not null,
          created_at integer not null,
          updated_at integer not null
        );
      `);
      createShortcut(
        { name: "Persistente", url: "https://example.test" },
        persistentConnection,
      );
      persistentConnection.close();

      persistentConnection = createDatabase(databasePath);
      expect(listShortcuts(persistentConnection)[0]?.name).toBe("Persistente");
    } finally {
      persistentConnection.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("adiciona somente atalhos genéricos de demonstração", () => {
    addDemoShortcuts(connection);

    expect(listShortcuts(connection).map(({ name }) => name)).toEqual([
      "Google Drive",
      "Google Classroom",
      "Gmail",
      "GitHub",
    ]);
    expect(() => addDemoShortcuts(connection)).toThrow(
      "Os atalhos de demonstração exigem uma lista vazia.",
    );
  });

  it("recusa protocolos que não sejam HTTP ou HTTPS", () => {
    expect(() =>
      createShortcut(
        { name: "Inválido", url: "javascript:alert(1)" },
        connection,
      ),
    ).toThrow();
  });
});
