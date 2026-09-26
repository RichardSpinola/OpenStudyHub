import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";

import type { DatabaseConnection } from "@/lib/db/client";
import { createMigratedTestDatabase } from "@/lib/test-database";

import {
  getHomeBackground,
  homeBackgroundLimitBytes,
  readHomeBackground,
  removeHomeBackground,
  saveHomeBackground,
} from "./home-background";

function createUser(connection: DatabaseConnection, login: string): number {
  const now = Date.now();
  return Number(
    connection.sqlite
      .prepare(
        `insert into users
         (display_name, login, password_hash, role, active,
          password_changed_at, created_at, updated_at)
         values ('Pessoa', ?, 'hash', 'member', 1, ?, ?, ?)`,
      )
      .run(login, now, now, now).lastInsertRowid,
  );
}

describe("background privado da Home", () => {
  let connection: DatabaseConnection;
  let assetRoot: string;
  let png: Buffer;
  let webp: Buffer;

  beforeEach(async () => {
    connection = createMigratedTestDatabase();
    assetRoot = await mkdtemp(join(tmpdir(), "osh-home-assets-"));
    const image = sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 20, g: 20, b: 20 },
      },
    });
    png = await image.clone().png().toBuffer();
    webp = await image.clone().webp().toBuffer();
  });

  afterEach(async () => {
    connection.close();
    await rm(assetRoot, { recursive: true, force: true });
  });

  it("mantém o limite público em 10 MiB", () => {
    expect(homeBackgroundLimitBytes).toBe(10 * 1024 * 1024);
  });

  it("adiciona, substitui e remove somente o asset do proprietário", async () => {
    const first = createUser(connection, "background.first");
    const second = createUser(connection, "background.second");
    const initial = await saveHomeBackground(first, png, {
      connection,
      assetRoot,
    });
    expect(initial.mimeType).toBe("image/png");
    expect(getHomeBackground(second, connection)).toBeNull();
    expect(
      (await readHomeBackground(first, { connection, assetRoot }))?.data,
    ).toEqual(png);

    const replacement = await saveHomeBackground(first, webp, {
      connection,
      assetRoot,
    });
    expect(replacement.storageName).not.toBe(initial.storageName);
    await expect(
      readFile(join(assetRoot, initial.storageName)),
    ).rejects.toThrow();

    await removeHomeBackground(first, { connection, assetRoot });
    expect(getHomeBackground(first, connection)).toBeNull();
    await expect(
      readFile(join(assetRoot, replacement.storageName)),
    ).rejects.toThrow();
  });

  it("rejeita conteúdo não reconhecido e arquivos acima do limite", async () => {
    const userId = createUser(connection, "background.invalid");
    await expect(
      saveHomeBackground(userId, Buffer.from("not-an-image"), {
        connection,
        assetRoot,
      }),
    ).rejects.toThrow("format");
    await expect(
      saveHomeBackground(userId, Buffer.alloc(homeBackgroundLimitBytes + 1), {
        connection,
        assetRoot,
      }),
    ).rejects.toThrow("size");
  });

  it("rejeita arquivo corrompido mesmo quando a assinatura parece PNG", async () => {
    const userId = createUser(connection, "background.corrupt");
    const corrupt = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    await expect(
      saveHomeBackground(userId, corrupt, { connection, assetRoot }),
    ).rejects.toThrow("format");
  });
});
