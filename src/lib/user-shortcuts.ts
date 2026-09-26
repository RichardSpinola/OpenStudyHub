import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import {
  DEFAULT_SHORTCUT_PRESETS,
  shortcutInputSchema,
  listShortcuts,
  type Shortcut,
  type ShortcutInput,
} from "@/lib/shortcuts";

const userIdSchema = z.number().int().positive();

const shortcutRowQuery = `
  select
    id,
    name,
    url,
    icon,
    icon_storage_name as iconStorageName,
    icon_mime_type as iconMimeType,
    sort_order as sortOrder,
    enabled
  from user_shortcuts
`;

function mapShortcut(row: Omit<Shortcut, "enabled"> & { enabled: number }) {
  return { ...row, enabled: row.enabled === 1 };
}

function parseShortcutInput(input: ShortcutInput) {
  const parsed = shortcutInputSchema.parse(input);
  return { ...parsed, icon: parsed.icon || null };
}

export function ensureUserShortcutsInitialized(
  userIdInput: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  initializeUserShortcuts(userIdInput, true, connection);
}

export function initializeUserShortcuts(
  userIdInput: number,
  includeDefaults: boolean,
  connection: DatabaseConnection = getDatabase(),
): void {
  const userId = userIdSchema.parse(userIdInput);
  const initialize = connection.sqlite.transaction(() => {
    const user = connection.sqlite
      .prepare(
        "select shortcuts_initialized as initialized from users where id = ? and active = 1",
      )
      .get(userId) as { initialized: number } | undefined;

    if (!user) throw new Error("Usuário não encontrado.");
    if (user.initialized === 1) return;

    const now = Date.now();
    if (includeDefaults) {
      connection.sqlite
        .prepare(
          `insert into user_shortcuts
           (user_id, name, url, icon, icon_storage_name, icon_mime_type,
            sort_order, enabled, created_at, updated_at)
           select ?, name, url, icon, icon_storage_name, icon_mime_type,
                  sort_order, enabled, ?, ?
           from shortcuts
           order by sort_order, id`,
        )
        .run(userId, now, now);
      if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
        const configuredUrls = new Set(
          listShortcuts(connection).map(({ url }) => url),
        );
        let nextOrder = (
          connection.sqlite
            .prepare(
              "select coalesce(max(sort_order), -1) + 1 as value from user_shortcuts where user_id = ?",
            )
            .get(userId) as { value: number }
        ).value;
        const addPreset = connection.sqlite.prepare(
          `insert into user_shortcuts
           (user_id, name, url, icon, sort_order, enabled, created_at, updated_at)
           values (?, ?, ?, ?, ?, 1, ?, ?)`,
        );
        for (const preset of DEFAULT_SHORTCUT_PRESETS) {
          if (configuredUrls.has(preset.url)) continue;
          addPreset.run(
            userId,
            preset.name,
            preset.url,
            preset.icon,
            nextOrder++,
            now,
            now,
          );
        }
      }
    }
    connection.sqlite
      .prepare(
        `update users
         set shortcuts_initialized = 1, updated_at = ?
         where id = ? and shortcuts_initialized = 0`,
      )
      .run(now, userId);
  });

  initialize.immediate();
}

export function listUserShortcuts(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): Shortcut[] {
  ensureUserShortcutsInitialized(userId, connection);
  return selectUserShortcuts(userId, connection);
}

function selectUserShortcuts(
  userId: number,
  connection: DatabaseConnection,
): Shortcut[] {
  const rows = connection.sqlite
    .prepare(
      `${shortcutRowQuery} where user_id = ? order by sort_order asc, id asc`,
    )
    .all(userId) as Array<Omit<Shortcut, "enabled"> & { enabled: number }>;
  return rows.map(mapShortcut);
}

export function listEnabledUserShortcuts(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): Shortcut[] {
  return listUserShortcuts(userId, connection).filter(({ enabled }) => enabled);
}

function getUserShortcut(
  userId: number,
  id: number,
  connection: DatabaseConnection,
): Shortcut {
  const row = connection.sqlite
    .prepare(`${shortcutRowQuery} where user_id = ? and id = ?`)
    .get(userId, id) as
    (Omit<Shortcut, "enabled"> & { enabled: number }) | undefined;
  if (!row) throw new Error("Atalho não encontrado.");
  return mapShortcut(row);
}

function normalizeUserSortOrder(
  userId: number,
  connection: DatabaseConnection,
) {
  const rows = connection.sqlite
    .prepare(
      "select id from user_shortcuts where user_id = ? order by sort_order, id",
    )
    .all(userId) as Array<{ id: number }>;
  const update = connection.sqlite.prepare(
    `update user_shortcuts set sort_order = ?, updated_at = ?
     where user_id = ? and id = ?`,
  );
  const now = Date.now();
  rows.forEach((row, index) => update.run(index, now, userId, row.id));
}

export function createUserShortcut(
  userId: number,
  input: ShortcutInput,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  ensureUserShortcutsInitialized(userId, connection);
  const shortcut = parseShortcutInput(input);
  const nextOrder = (
    connection.sqlite
      .prepare(
        `select coalesce(max(sort_order), -1) + 1 as value
         from user_shortcuts where user_id = ?`,
      )
      .get(userId) as { value: number }
  ).value;
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into user_shortcuts
       (user_id, name, url, icon, sort_order, enabled, created_at, updated_at)
       values (?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      userId,
      shortcut.name,
      shortcut.url,
      shortcut.icon,
      nextOrder,
      now,
      now,
    );
  return getUserShortcut(userId, Number(result.lastInsertRowid), connection);
}

export function updateUserShortcut(
  userId: number,
  id: number,
  input: ShortcutInput,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  ensureUserShortcutsInitialized(userId, connection);
  const shortcut = parseShortcutInput(input);
  const result = connection.sqlite
    .prepare(
      `update user_shortcuts
       set name = ?, url = ?, icon = ?, updated_at = ?
       where user_id = ? and id = ?`,
    )
    .run(shortcut.name, shortcut.url, shortcut.icon, Date.now(), userId, id);
  if (result.changes !== 1) throw new Error("Atalho não encontrado.");
  return getUserShortcut(userId, id, connection);
}

export function setUserShortcutEnabled(
  userId: number,
  id: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  ensureUserShortcutsInitialized(userId, connection);
  const result = connection.sqlite
    .prepare(
      `update user_shortcuts set enabled = ?, updated_at = ?
       where user_id = ? and id = ?`,
    )
    .run(enabled ? 1 : 0, Date.now(), userId, id);
  if (result.changes !== 1) throw new Error("Atalho não encontrado.");
  return getUserShortcut(userId, id, connection);
}

export function moveUserShortcut(
  userId: number,
  id: number,
  direction: "up" | "down",
  connection: DatabaseConnection = getDatabase(),
): void {
  ensureUserShortcutsInitialized(userId, connection);
  connection.sqlite.transaction(() => {
    normalizeUserSortOrder(userId, connection);
    const shortcuts = selectUserShortcuts(userId, connection);
    const currentIndex = shortcuts.findIndex((shortcut) => shortcut.id === id);
    if (currentIndex === -1) throw new Error("Atalho não encontrado.");
    const destinationIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const destination = shortcuts[destinationIndex];
    if (!destination) return;
    const update = connection.sqlite.prepare(
      `update user_shortcuts set sort_order = ?, updated_at = ?
       where user_id = ? and id = ?`,
    );
    const now = Date.now();
    update.run(destination.sortOrder, now, userId, id);
    update.run(shortcuts[currentIndex].sortOrder, now, userId, destination.id);
  })();
}

export function reorderEnabledUserShortcuts(
  userId: number,
  orderedIds: number[],
  connection: DatabaseConnection = getDatabase(),
): void {
  const shortcuts = listUserShortcuts(userId, connection);
  const enabledIds = shortcuts
    .filter(({ enabled }) => enabled)
    .map(({ id }) => id);
  const expected = [...enabledIds].sort((left, right) => left - right);
  const received = [...orderedIds].sort((left, right) => left - right);
  if (
    orderedIds.length !== enabledIds.length ||
    expected.some((id, index) => id !== received[index])
  ) {
    throw new Error("Ordenação de atalhos inválida.");
  }

  let enabledIndex = 0;
  const completeOrder = shortcuts.map((shortcut) =>
    shortcut.enabled ? orderedIds[enabledIndex++] : shortcut.id,
  );
  connection.sqlite.transaction(() => {
    const update = connection.sqlite.prepare(
      `update user_shortcuts set sort_order = ?, updated_at = ?
       where user_id = ? and id = ?`,
    );
    const now = Date.now();
    completeOrder.forEach((id, index) => update.run(index, now, userId, id));
  })();
}

export function deleteUserShortcut(
  userId: number,
  id: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  ensureUserShortcutsInitialized(userId, connection);
  connection.sqlite.transaction(() => {
    const result = connection.sqlite
      .prepare("delete from user_shortcuts where user_id = ? and id = ?")
      .run(userId, id);
    if (result.changes !== 1) throw new Error("Atalho não encontrado.");
    normalizeUserSortOrder(userId, connection);
  })();
}
