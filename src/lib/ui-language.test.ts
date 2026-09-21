import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";

import {
  defaultUiLanguage,
  getUiLanguage,
  resolveUiLanguage,
  updateUiLanguage,
} from "./ui-language";

describe("idioma da interface", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createDatabase(":memory:");
    connection.sqlite.exec(`
      create table app_settings (
        key text primary key not null,
        value text not null,
        updated_at integer not null
      );
    `);
  });

  afterEach(() => connection.close());

  it("usa Português (Brasil) como fallback", () => {
    expect(resolveUiLanguage(undefined)).toBe(defaultUiLanguage);
    expect(resolveUiLanguage("idioma-inválido")).toBe(defaultUiLanguage);
    expect(getUiLanguage(connection)).toBe("pt-BR");
  });

  it("persiste a seleção de English", () => {
    updateUiLanguage("en", connection);
    expect(getUiLanguage(connection)).toBe("en");
  });

  it("rejeita idiomas fora do catálogo", () => {
    expect(() => updateUiLanguage("fr", connection)).toThrow();
  });
});
