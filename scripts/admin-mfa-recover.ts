import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { openV2Database, migrateV2 } from "../src/lib/v2/database";
import { operatorResetMfa } from "../src/lib/security/admin-mfa";
const path = process.env.OPENSTUDYHUB_V2_DATABASE_PATH;
if (!path?.startsWith("/"))
  throw new Error(
    "Set OPENSTUDYHUB_V2_DATABASE_PATH to the canonical database.",
  );
if (!stdin.isTTY)
  throw new Error(
    "Interactive terminal required. / Terminal interativo obrigatório.",
  );
const prompt = createInterface({ input: stdin, output: stdout });
try {
  const login = (await prompt.question("Admin login: ")).trim();
  if (
    (await prompt.question(
      `Disable MFA and revoke all sessions for ${login}? Type RESET ${login}: `,
    )) !== `RESET ${login}`
  )
    throw new Error("Cancelled.");
  const db = openV2Database(path);
  try {
    migrateV2(db);
    operatorResetMfa(db, login);
    stdout.write(
      "MFA reset recorded. Sign in and configure a new authenticator.\n",
    );
  } finally {
    db.close();
  }
} finally {
  prompt.close();
}
