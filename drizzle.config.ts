import { defineConfig } from "drizzle-kit";

import { getServerEnvironment } from "./src/lib/env";
import { loadProjectEnvironment } from "./src/lib/load-project-environment";

loadProjectEnvironment();
const environment = getServerEnvironment();

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: environment.DATABASE_PATH,
  },
  strict: true,
  verbose: true,
});
