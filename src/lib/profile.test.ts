import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getUserProfile,
  setTodayWidgetEnabled,
  updateOwnHomePreferences,
  updateOwnProfile,
} from "./profile";

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

describe("perfil do usuário", () => {
  let connection: DatabaseConnection;

  beforeEach(() => {
    connection = createMigratedTestDatabase();
  });

  afterEach(() => connection.close());

  it("atualiza nome e idioma somente do usuário indicado", () => {
    const firstId = createTestUser(connection, "primeira.pessoa");
    const secondId = createTestUser(connection, "segunda.pessoa");

    expect(
      updateOwnProfile(
        firstId,
        {
          displayName: "  Nome Atualizado  ",
          locale: "en",
        },
        connection,
      ),
    ).toMatchObject({
      displayName: "Nome Atualizado",
      locale: "en",
      todayWidgetEnabled: true,
      theme: "dark",
      homeClockEnabled: true,
      homeClockPosition: "top-right",
    });
    expect(getUserProfile(firstId, connection)).toMatchObject({
      displayName: "Nome Atualizado",
      locale: "en",
      todayWidgetEnabled: true,
      theme: "dark",
      homeClockEnabled: true,
      homeClockPosition: "top-right",
    });
    expect(getUserProfile(secondId, connection)).toMatchObject({
      displayName: "Pessoa Teste",
      locale: "pt-BR",
      todayWidgetEnabled: true,
      theme: "dark",
      homeClockEnabled: true,
      homeClockPosition: "top-right",
    });
  });

  it("rejeita nome fora dos limites e locale não suportado", () => {
    const userId = createTestUser(connection, "pessoa.teste");

    expect(() =>
      updateOwnProfile(
        userId,
        { displayName: "x", locale: "pt-BR" },
        connection,
      ),
    ).toThrow();
    expect(() =>
      updateOwnProfile(
        userId,
        {
          displayName: "Pessoa Teste",
          locale: "fr" as "pt-BR",
        },
        connection,
      ),
    ).toThrow();
  });

  it("persiste a preferência do widget Today por usuário", () => {
    const userId = createTestUser(connection, "widget.teste");
    setTodayWidgetEnabled(userId, false, connection);
    expect(getUserProfile(userId, connection).todayWidgetEnabled).toBe(false);
  });

  it("persiste tema e relógio somente no perfil indicado", () => {
    const firstId = createTestUser(connection, "tema.primeiro");
    const secondId = createTestUser(connection, "tema.segundo");
    updateOwnHomePreferences(
      firstId,
      {
        theme: "light",
        todayWidgetEnabled: false,
        homeClockEnabled: false,
        homeClockPosition: "bottom-left",
      },
      connection,
    );
    expect(getUserProfile(firstId, connection)).toMatchObject({
      theme: "light",
      todayWidgetEnabled: false,
      homeClockEnabled: false,
      homeClockPosition: "bottom-left",
    });
    expect(getUserProfile(secondId, connection)).toMatchObject({
      theme: "dark",
      homeClockEnabled: true,
      homeClockPosition: "top-right",
    });
  });

  it.each(["top-left", "top-right", "bottom-left", "bottom-right"] as const)(
    "persiste a posição %s do relógio",
    (homeClockPosition) => {
      const userId = createTestUser(connection, `clock.${homeClockPosition}`);
      const profile = updateOwnHomePreferences(
        userId,
        {
          theme: "dark",
          todayWidgetEnabled: true,
          homeClockEnabled: true,
          homeClockPosition,
        },
        connection,
      );
      expect(profile.homeClockPosition).toBe(homeClockPosition);
    },
  );
});
