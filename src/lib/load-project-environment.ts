import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

export function isDevelopmentEnvironment(
  nodeEnvironment: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnvironment === "development";
}

export function loadProjectEnvironment(
  projectDirectory: string = process.cwd(),
): void {
  loadEnvConfig(projectDirectory, isDevelopmentEnvironment());
}
