import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createDatabase, type DatabaseConnection } from "@/lib/db/client";

export const migrationFiles = [
  "0000_kind_cobalt_man.sql",
  "0001_academic_core.sql",
  "0002_access_admin_foundation.sql",
  "0003_omniscient_colleen_wing.sql",
  "0004_busy_blackheart.sql",
  "0005_elite_darkstar.sql",
  "0006_lush_union_jack.sql",
  "0007_flat_abomination.sql",
  "0008_medical_emma_frost.sql",
  "0009_overrated_nekra.sql",
  "0010_polite_spyke.sql",
  "0011_round_carnage.sql",
  "0012_lean_rictor.sql",
  "0013_salty_christian_walker.sql",
  "0014_left_butterfly.sql",
  "0015_person_shares.sql",
] as const;

export function applyMigration(
  connection: DatabaseConnection,
  filename: (typeof migrationFiles)[number],
): void {
  const sql = readFileSync(resolve(process.cwd(), "drizzle", filename), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) connection.sqlite.exec(statement);
  }
}

export function createMigratedTestDatabase(): DatabaseConnection {
  const connection = createDatabase(":memory:");
  for (const migration of migrationFiles) applyMigration(connection, migration);
  return connection;
}
