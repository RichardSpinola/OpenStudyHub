import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";
import { z } from "zod";

export type Shortcut = {
  id: number;
  name: string;
  url: string;
  icon: string | null;
  iconStorageName: string | null;
  iconMimeType: string | null;
  sortOrder: number;
  enabled: boolean;
};

export type ShortcutInput = {
  name: string;
  url: string;
  icon?: string | null;
};

export const shortcutInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: z
    .url()
    .max(2048)
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "https:" || protocol === "http:";
    }, "O atalho deve usar HTTP ou HTTPS."),
  icon: z.string().trim().max(8).optional().nullable(),
});

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
  from shortcuts
`;

function mapShortcut(row: Omit<Shortcut, "enabled"> & { enabled: number }) {
  return { ...row, enabled: row.enabled === 1 };
}

function parseShortcutInput(input: ShortcutInput) {
  const parsed = shortcutInputSchema.parse(input);
  return { ...parsed, icon: parsed.icon || null };
}

function normalizeSortOrder(connection: DatabaseConnection) {
  const rows = connection.sqlite
    .prepare("select id from shortcuts order by sort_order asc, id asc")
    .all() as Array<{ id: number }>;
  const update = connection.sqlite.prepare(
    "update shortcuts set sort_order = ?, updated_at = ? where id = ?",
  );
  const now = Date.now();

  rows.forEach((row, index) => update.run(index, now, row.id));
}

export function listShortcuts(
  connection: DatabaseConnection = getDatabase(),
): Shortcut[] {
  const rows = connection.sqlite
    .prepare(`${shortcutRowQuery} order by sort_order asc, id asc`)
    .all() as Array<Omit<Shortcut, "enabled"> & { enabled: number }>;

  return rows.map(mapShortcut);
}

export function listEnabledShortcuts(
  connection: DatabaseConnection = getDatabase(),
): Shortcut[] {
  const rows = connection.sqlite
    .prepare(
      `${shortcutRowQuery} where enabled = 1 order by sort_order asc, id asc`,
    )
    .all() as Array<Omit<Shortcut, "enabled"> & { enabled: number }>;

  return rows.map(mapShortcut);
}

export function createShortcut(
  input: ShortcutInput,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  const shortcut = parseShortcutInput(input);
  const nextOrder = (
    connection.sqlite
      .prepare(
        "select coalesce(max(sort_order), -1) + 1 as value from shortcuts",
      )
      .get() as { value: number }
  ).value;
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      `insert into shortcuts
       (name, url, icon, sort_order, enabled, created_at, updated_at)
       values (?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(shortcut.name, shortcut.url, shortcut.icon, nextOrder, now, now);

  return getShortcut(Number(result.lastInsertRowid), connection);
}

export function updateShortcut(
  id: number,
  input: ShortcutInput,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  const shortcut = parseShortcutInput(input);
  const result = connection.sqlite
    .prepare(
      `update shortcuts
       set name = ?, url = ?, icon = ?, updated_at = ?
       where id = ?`,
    )
    .run(shortcut.name, shortcut.url, shortcut.icon, Date.now(), id);

  if (result.changes !== 1) {
    throw new Error("Atalho não encontrado.");
  }

  return getShortcut(id, connection);
}

export function setShortcutEnabled(
  id: number,
  enabled: boolean,
  connection: DatabaseConnection = getDatabase(),
): Shortcut {
  const result = connection.sqlite
    .prepare("update shortcuts set enabled = ?, updated_at = ? where id = ?")
    .run(enabled ? 1 : 0, Date.now(), id);

  if (result.changes !== 1) {
    throw new Error("Atalho não encontrado.");
  }

  return getShortcut(id, connection);
}

export function moveShortcut(
  id: number,
  direction: "up" | "down",
  connection: DatabaseConnection = getDatabase(),
): void {
  connection.sqlite.transaction(() => {
    normalizeSortOrder(connection);
    const shortcuts = listShortcuts(connection);
    const currentIndex = shortcuts.findIndex((shortcut) => shortcut.id === id);

    if (currentIndex === -1) {
      throw new Error("Atalho não encontrado.");
    }

    const destinationIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const destination = shortcuts[destinationIndex];

    if (!destination) {
      return;
    }

    const update = connection.sqlite.prepare(
      "update shortcuts set sort_order = ?, updated_at = ? where id = ?",
    );
    const now = Date.now();
    update.run(destination.sortOrder, now, id);
    update.run(shortcuts[currentIndex].sortOrder, now, destination.id);
  })();
}

export function reorderShortcuts(
  orderedIds: number[],
  connection: DatabaseConnection = getDatabase(),
): void {
  const currentIds = listShortcuts(connection).map(({ id }) => id);
  const normalizedCurrentIds = [...currentIds].sort(
    (left, right) => left - right,
  );
  const normalizedOrderedIds = [...orderedIds].sort(
    (left, right) => left - right,
  );

  if (
    orderedIds.length !== currentIds.length ||
    normalizedCurrentIds.some((id, index) => id !== normalizedOrderedIds[index])
  ) {
    throw new Error("Ordenação de atalhos inválida.");
  }

  connection.sqlite.transaction(() => {
    const update = connection.sqlite.prepare(
      "update shortcuts set sort_order = ?, updated_at = ? where id = ?",
    );
    const now = Date.now();

    orderedIds.forEach((id, index) => update.run(index, now, id));
  })();
}

export function reorderEnabledShortcuts(
  orderedIds: number[],
  connection: DatabaseConnection = getDatabase(),
): void {
  const shortcuts = listShortcuts(connection);
  const enabledIds = shortcuts
    .filter(({ enabled }) => enabled)
    .map(({ id }) => id);
  const normalizedEnabledIds = [...enabledIds].sort(
    (left, right) => left - right,
  );
  const normalizedOrderedIds = [...orderedIds].sort(
    (left, right) => left - right,
  );

  if (
    orderedIds.length !== enabledIds.length ||
    normalizedEnabledIds.some((id, index) => id !== normalizedOrderedIds[index])
  ) {
    throw new Error("Ordenação de atalhos ativos inválida.");
  }

  let enabledIndex = 0;
  const completeOrder = shortcuts.map((shortcut) =>
    shortcut.enabled ? orderedIds[enabledIndex++] : shortcut.id,
  );

  reorderShortcuts(completeOrder, connection);
}

export function deleteShortcut(
  id: number,
  connection: DatabaseConnection = getDatabase(),
): void {
  connection.sqlite.transaction(() => {
    connection.sqlite.prepare("delete from shortcuts where id = ?").run(id);
    normalizeSortOrder(connection);
  })();
}

export function addDemoShortcuts(
  connection: DatabaseConnection = getDatabase(),
): Shortcut[] {
  if (listShortcuts(connection).length > 0) {
    throw new Error("Os atalhos de demonstração exigem uma lista vazia.");
  }

  const created: Shortcut[] = [];
  connection.sqlite.transaction(() => {
    [
      { name: "Google Drive", url: "https://drive.google.com", icon: "DRV" },
      {
        name: "Google Classroom",
        url: "https://classroom.google.com",
        icon: "CLS",
      },
      { name: "Gmail", url: "https://mail.google.com", icon: "MAIL" },
      { name: "GitHub", url: "https://github.com", icon: "GH" },
    ].forEach((shortcut) => created.push(createShortcut(shortcut, connection)));
  })();
  return created;
}

function getShortcut(id: number, connection: DatabaseConnection): Shortcut {
  const row = connection.sqlite
    .prepare(`${shortcutRowQuery} where id = ?`)
    .get(id) as (Omit<Shortcut, "enabled"> & { enabled: number }) | undefined;

  if (!row) {
    throw new Error("Atalho não encontrado.");
  }

  return mapShortcut(row);
}
