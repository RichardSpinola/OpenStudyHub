import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  addExternalLink,
  deleteExternalLink,
  listExternalLinks,
} from "./external-links";

function createAdmin(connection: DatabaseConnection) {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Admin', 'admin-links', 'hash', 'admin', 1, ?, ?, ?)`,
      )
      .run(now, now, now).lastInsertRowid,
  );
}

describe("external links", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("preserva o link legado de documentação e permite migrar para vários links", () => {
    const adminId = createAdmin(connection);
    connection.sqlite
      .prepare(
        `insert into app_settings (key, value, updated_at)
         values ('documentation.external_url', 'https://docs.example.test/', ?)`,
      )
      .run(Date.now());

    expect(listExternalLinks(connection)).toEqual([
      expect.objectContaining({
        label: "Documentação",
        url: "https://docs.example.test/",
      }),
    ]);

    const drive = addExternalLink(
      adminId,
      {
        label: "Drive acadêmico",
        url: "https://drive.google.com/",
        newTab: true,
      },
      connection,
    );

    expect(listExternalLinks(connection).map(({ label }) => label)).toEqual([
      "Documentação",
      "Drive acadêmico",
    ]);

    deleteExternalLink(adminId, drive.id, connection);
    expect(listExternalLinks(connection).map(({ label }) => label)).toEqual([
      "Documentação",
    ]);
  });

  it("recusa URL HTTP pública insegura", () => {
    const adminId = createAdmin(connection);
    expect(() =>
      addExternalLink(
        adminId,
        { label: "Ruim", url: "http://example.test/" },
        connection,
      ),
    ).toThrow();
  });
});
