import { afterEach, describe, expect, it } from "vitest";

import {
  checkDatabaseConnection,
  createDatabase,
  type DatabaseConnection,
} from "./client";

describe("SQLite", () => {
  let connection: DatabaseConnection | undefined;

  afterEach(() => {
    connection?.close();
    connection = undefined;
  });

  it("abre uma conexão operacional em memória", () => {
    connection = createDatabase(":memory:");
    expect(checkDatabaseConnection(connection)).toBe(true);
  });
});
