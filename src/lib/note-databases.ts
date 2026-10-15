import { z } from "zod";

export const noteFieldSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  type: z.enum(["text", "number", "date", "checkbox"]),
});
export type NoteField = z.infer<typeof noteFieldSchema>;
export type NoteDatabase = {
  id: string;
  name: string;
  fields: NoteField[];
  rows: {
    id: string;
    name: string;
    status: string;
    cells: Record<string, string>;
  }[];
};
export const noteStatuses = ["todo", "doing", "done"] as const;

export function readNoteDatabases(
  entries: Record<string, string>,
): NoteDatabase[] {
  const result: NoteDatabase[] = [];
  for (const [key, name] of Object.entries(entries)) {
    if (
      !key.startsWith("db:") ||
      !z.string().uuid().safeParse(key.slice(3)).success
    )
      continue;
    const id = key.slice(3);
    const fields = Object.entries(entries).flatMap(([k, v]) => {
      if (!k.startsWith(`field:${id}:`)) return [];
      try {
        const p = noteFieldSchema.safeParse(JSON.parse(v));
        return p.success ? [p.data] : [];
      } catch {
        return [];
      }
    });
    const rows = Object.keys(entries)
      .filter((k) => k.startsWith(`row:${id}:`))
      .map((k) => {
        const rowId = k.slice(`row:${id}:`.length);
        const cell = (field: string) =>
          entries[`cell:${id}:${rowId}:${field}`] ?? "";
        return {
          id: rowId,
          name: cell("name"),
          status: noteStatuses.includes(
            cell("status") as (typeof noteStatuses)[number],
          )
            ? cell("status")
            : "todo",
          cells: Object.fromEntries(fields.map((f) => [f.id, cell(f.id)])),
        };
      });
    result.push({ id, name, fields, rows });
  }
  return result;
}

export function validateNoteDatabases(
  entries: Record<string, unknown>,
): asserts entries is Record<string, string> {
  if (Object.keys(entries).length > 10000)
    throw new Error("A base atingiu o limite de células desta página.");
  const uuid = "[0-9a-f-]{36}";
  const key = new RegExp(
    `^(db:${uuid}|field:${uuid}:${uuid}|row:${uuid}:${uuid}|cell:${uuid}:${uuid}:(name|status|${uuid}))$`,
    "i",
  );
  for (const [k, v] of Object.entries(entries)) {
    if (!key.test(k) || typeof v !== "string" || v.length > 2000)
      throw new Error("Campo inválido na base.");
    if (k.startsWith("field:")) noteFieldSchema.parse(JSON.parse(v));
  }
  const dbs = readNoteDatabases(entries as Record<string, string>);
  if (
    dbs.length > 12 ||
    dbs.some((d) => d.fields.length > 20 || d.rows.length > 300)
  )
    throw new Error("Use até 12 bases, 20 campos e 300 registros por base.");
}

export function noteDatabasesMarkdown(entries: Record<string, string>): string {
  const esc = (v: string) => v.replaceAll("|", "\\|").replaceAll("\n", " ");
  const statuses: Record<string, string> = {
    todo: "A fazer",
    doing: "Em andamento",
    done: "Concluído",
  };
  return readNoteDatabases(entries)
    .map((d) => {
      const headers = ["Nome", "Status", ...d.fields.map((f) => f.name)];
      return `## ${d.name}\n\n| ${headers.map(esc).join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${d.rows.map((row) => `| ${[row.name, statuses[row.status], ...d.fields.map((f) => row.cells[f.id] || "")].map(esc).join(" | ")} |`).join("\n")}`;
    })
    .join("\n\n");
}
