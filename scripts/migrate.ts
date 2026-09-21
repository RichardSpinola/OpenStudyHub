import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";

import { createDatabase } from "../src/lib/db/client";
import { getServerEnvironment } from "../src/lib/env";
import { loadProjectEnvironment } from "../src/lib/load-project-environment";

loadProjectEnvironment();

const connection = createDatabase(getServerEnvironment().DATABASE_PATH);

try {
  migrate(connection.db, {
    migrationsFolder: resolve(process.cwd(), "drizzle"),
  });
  console.log("Migrations aplicadas com sucesso.");
} finally {
  connection.close();
}
