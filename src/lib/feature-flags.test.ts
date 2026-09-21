import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  isProjectsFeatureEnabled,
  setProjectsFeatureEnabled,
} from "./feature-flags";

describe("feature flags", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("mantém Projects ativo por padrão e permite ao admin ocultar sem apagar dados", () => {
    const now = Date.now();
    const adminId = Number(
      connection.sqlite
        .prepare(
          `insert into users
           (display_name, login, password_hash, role, active,
            password_changed_at, created_at, updated_at)
           values ('Admin', 'admin-feature', 'hash', 'admin', 1, ?, ?, ?)`,
        )
        .run(now, now, now).lastInsertRowid,
    );
    expect(isProjectsFeatureEnabled(connection)).toBe(true);
    setProjectsFeatureEnabled(adminId, false, connection);
    expect(isProjectsFeatureEnabled(connection)).toBe(false);
    setProjectsFeatureEnabled(adminId, true, connection);
    expect(isProjectsFeatureEnabled(connection)).toBe(true);
  });
});
