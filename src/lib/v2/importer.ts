import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { V2Database } from "./database";

export type ImportCategory =
  "MIGRATE" | "TRANSFORM" | "REVIEW" | "SKIP/RUNTIME";
export type ImportPlanRow = {
  table: string;
  category: ImportCategory;
  count: number;
};
const valid = new Set<ImportCategory>([
  "MIGRATE",
  "TRANSFORM",
  "REVIEW",
  "SKIP/RUNTIME",
]);

export function loadV1ImportMatrix(
  path = resolve(process.cwd(), "docs/migrations/V1_IMPORT_MATRIX.md"),
): Map<string, ImportCategory> {
  const map = new Map<string, ImportCategory>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match =
      /^\|\s*\d+\s*\|\s*`([a-z_]+)`\s*\|\s*(MIGRATE|TRANSFORM|REVIEW|SKIP\/RUNTIME)\s*\|/.exec(
        line,
      );
    if (!match) continue;
    const category = match[2] as ImportCategory;
    if (!valid.has(category) || map.has(match[1]))
      throw new Error("Invalid import matrix");
    map.set(match[1], category);
  }
  if (map.size !== 52)
    throw new Error("Import matrix must classify all 52 V1 tables");
  return map;
}

export function previewV1Import(
  source: V2Database,
  target: V2Database,
  matrix = loadV1ImportMatrix(),
): { runId: number; rows: ImportPlanRow[]; reviewCount: number } {
  const tables = source
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as { name: string }[];
  const actual = new Set(tables.map((x) => x.name));
  if (
    actual.size !== matrix.size ||
    [...actual].some((name) => !matrix.has(name))
  )
    throw new Error("V1 schema does not match the reviewed matrix");
  const rows: ImportPlanRow[] = [...matrix].map(([table, category]) => {
    // Identifier is from the reviewed static matrix, never user input.
    const count = (
      source.prepare(`SELECT count(*) n FROM "${table}"`).get() as { n: number }
    ).n;
    return { table, category, count };
  });
  const fingerprint = createHash("sha256")
    .update(
      rows
        .map(({ table, category, count }) => `${table}:${category}:${count}`)
        .join("\n"),
    )
    .digest("hex");
  return target.transaction(() => {
    const runId = Number(
      target
        .prepare(
          "INSERT INTO import_runs(source_fingerprint,status) VALUES(?,'preview')",
        )
        .run(fingerprint).lastInsertRowid,
    );
    let reviewCount = 0;
    const addReview = target.prepare(
      "INSERT INTO import_review_items(run_id,source_table,source_id,reason_code) VALUES(?,?,?,?)",
    );
    for (const row of rows) {
      if (row.category === "REVIEW" && row.count > 0) {
        addReview.run(runId, row.table, null, "policy_required");
        reviewCount++;
      }
    }
    const legacyAdmins = source
      .prepare("SELECT id FROM users WHERE role='admin'")
      .all() as Array<{ id: number }>;
    for (const user of legacyAdmins) {
      addReview.run(runId, "users", user.id, "legacy_role_not_control_admin");
      reviewCount++;
    }
    const offerings = source
      .prepare(
        "SELECT id,curriculum_term FROM subject_offerings WHERE curriculum_term IS NOT NULL AND trim(curriculum_term)<>''",
      )
      .all() as { id: number; curriculum_term: string }[];
    for (const offering of offerings) {
      addReview.run(
        runId,
        "subject_offerings",
        offering.id,
        "curriculum_term_unverified",
      );
      reviewCount++;
    }
    const globalMappings = source
      .prepare(
        "SELECT offering_id id FROM offering_google_integrations WHERE classroom_course_id IS NOT NULL",
      )
      .all() as { id: number }[];
    for (const mapping of globalMappings) {
      addReview.run(
        runId,
        "offering_google_integrations",
        mapping.id,
        "classroom_mapping_not_personal",
      );
      reviewCount++;
    }
    if (reviewCount)
      target
        .prepare("UPDATE import_runs SET status='blocked' WHERE id=?")
        .run(runId);
    return { runId, rows, reviewCount };
  })();
}

export function stageIdMapping(
  target: V2Database,
  runId: number,
  sourceTable: string,
  sourceId: number,
  targetTable: string,
  targetId: number,
  matrix = loadV1ImportMatrix(),
): void {
  const category = matrix.get(sourceTable);
  if (category !== "MIGRATE" && category !== "TRANSFORM")
    throw new Error("This V1 table cannot be promoted automatically");
  target
    .prepare(
      "INSERT INTO import_id_map(run_id,source_table,source_id,target_table,target_id) VALUES(?,?,?,?,?)",
    )
    .run(runId, sourceTable, sourceId, targetTable, targetId);
}
