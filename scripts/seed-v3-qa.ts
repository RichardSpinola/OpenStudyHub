// Development fixture only. Never reset an existing database or import a real instance.
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDatabase } from "../src/lib/db/client";
import { openV2Database, migrateV2 } from "../src/lib/v2/database";
import { seedV2Fake } from "../src/lib/v2/fixtures";
import { ensureLegacyLink } from "../src/lib/v2/identity-bridge";
import { hashPassword } from "../src/lib/password";

const root = process.env.OPENSTUDYHUB_QA_ROOT;
if (
  process.env.NODE_ENV === "production" ||
  process.env.OPENSTUDYHUB_QA_ONLY !== "1" ||
  !root ||
  !root.startsWith("/")
)
  throw new Error("Explicit local QA environment required.");
const directory = resolve(root),
  legacyPath = join(directory, "qa-legacy.db"),
  canonicalPath = join(directory, "qa-v2.db");
if (existsSync(legacyPath) || existsSync(canonicalPath))
  throw new Error(
    "QA database already exists; preserving it. Use another QA directory to create a fixture.",
  );
mkdirSync(directory, { recursive: true, mode: 0o700 });
const password = "QA-V3-Somente-2026";
const hash = await hashPassword(password);
const legacy = createDatabase(legacyPath),
  canonical = openV2Database(canonicalPath);
try {
  migrate(legacy.db, { migrationsFolder: resolve("drizzle") });
  migrateV2(canonical);
  seedV2Fake(canonical, hash);
  legacy.sqlite
    .prepare(
      "INSERT INTO app_settings(key,value,updated_at) VALUES('ui.language','pt-BR',?),('institution.display_name','IFA',?)",
    )
    .run(Date.now(), Date.now());
  // Keep a period active now, so the local schedule has useful fictitious content.
  const year = new Date().getFullYear();
  canonical
    .prepare(
      "UPDATE academic_periods SET label=?,starts_on=?,ends_on=? WHERE id=1",
    )
    .run(`${year}.2`, `${year}-08-01`, `${year}-12-31`);
  for (const userId of [2, 3, 4, 5]) {
    const legacyId = await ensureLegacyLink(
      canonical,
      userId,
      password,
      legacy,
    );
    legacy.sqlite
      .prepare(
        "UPDATE users SET onboarding_version=1,locale='pt-BR',today_widget_enabled=1,home_clock_enabled=1 WHERE id=?",
      )
      .run(legacyId);
  }
  writeFileSync(
    join(directory, "login-local.txt"),
    `FICTITIOUS LOCAL QA ONLY\nApp: student.a.fake or student.b.fake\nAdmin: admin.fake\nPassword: ${password}\nNo Google credentials or real data.\n`,
    { mode: 0o600 },
  );
  console.log(
    "Local fictitious QA created; credentials are in login-local.txt. No existing data reset.",
  );
} finally {
  canonical.close();
  legacy.close();
}
