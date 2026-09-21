import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";

import {
  defaultBrandConfig,
  figletFontOptions,
  generateAsciiLogo,
  getAsciiLogo,
  getBrandConfig,
  updateBrandConfig,
} from "./home-settings";

describe("identidade da Home", () => {
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

  it("gera a identidade FIGlet padrão sem configuração manual", () => {
    const logo = getAsciiLogo(connection);

    expect(logo).toContain("█");
    expect(logo.split("\n").length).toBeGreaterThan(1);
    expect(defaultBrandConfig).toEqual({
      text: "OpenStudyHub",
      font: "ANSI Shadow",
    });
    expect(getBrandConfig(connection)).toEqual(defaultBrandConfig);
  });

  it("usa ANSI Shadow como fallback para uma fonte armazenada inválida", () => {
    connection.sqlite
      .prepare(
        "insert into app_settings (key, value, updated_at) values (?, ?, ?)",
      )
      .run("home.brand_figlet_font", "Fonte inexistente", Date.now());

    expect(getBrandConfig(connection)).toEqual(defaultBrandConfig);
  });

  it("persiste texto e fonte válidos", () => {
    updateBrandConfig({ text: "StudyHub", font: "Rectangles" }, connection);

    expect(getBrandConfig(connection)).toEqual({
      text: "StudyHub",
      font: "Rectangles",
    });
    expect(getAsciiLogo(connection)).toBe(
      generateAsciiLogo({ text: "StudyHub", font: "Rectangles" }),
    );
  });

  it("oferece somente fontes disponíveis no pacote", async () => {
    const figlet = await import("figlet");
    const availableFonts = figlet.default.fontsSync();

    expect(
      figletFontOptions.every((font) => availableFonts.includes(font)),
    ).toBe(true);
  });

  it("recusa texto vazio e fonte fora da allowlist", () => {
    expect(() =>
      updateBrandConfig({ text: "   ", font: "Small" }, connection),
    ).toThrow();
    expect(() =>
      updateBrandConfig(
        { text: "OpenStudyHub", font: "Ghost" as "Small" },
        connection,
      ),
    ).toThrow();
  });
});
