import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { openV2Database, migrateV2 } from "../src/lib/v2/database";
import { seedV2Fake } from "../src/lib/v2/fixtures";
import { hashPassword } from "../src/lib/password";

const confirmation = "--confirm-reset-fake-v2";
const marker = "OPENSTUDYHUB_V2_FAKE_RUNTIME_ONLY\n";

export function validateFakeReset(input: {
  repo: string;
  runtime: string;
  dbPath: string;
  nodeEnv?: string;
  consent?: string;
  args: string[];
}): string {
  if (input.nodeEnv !== "development" && input.nodeEnv !== "test")
    throw new Error("Fake reset requires development/test");
  if (
    input.consent !== "RESET_FAKE_V2_ONLY" ||
    !input.args.includes(confirmation)
  )
    throw new Error("Fake reset confirmation missing");
  const repo = resolve(input.repo);
  const runtime = resolve(input.runtime);
  if (
    basename(repo) !== "OpenStudyHub-v2-dev" ||
    basename(runtime) !== "OpenStudyHub-v2-runtime" ||
    dirname(repo) !== dirname(runtime)
  )
    throw new Error("Unexpected V2 workspace");
  if (realpathSync(repo) !== repo || realpathSync(runtime) !== runtime)
    throw new Error("Symlinked V2 workspace refused");
  if (existsSync(join(runtime, ".git")))
    throw new Error("Runtime must be outside Git");
  if (readFileSync(join(runtime, ".fake-runtime-marker"), "utf8") !== marker)
    throw new Error("Fake runtime marker missing");
  const db = resolve(input.dbPath);
  if (db !== join(runtime, "data", "v2-fake.db"))
    throw new Error("Reset path is not the dedicated fake V2 database");
  const data = dirname(db);
  if (realpathSync(data) !== data || lstatSync(data).isSymbolicLink())
    throw new Error("Symlinked data directory refused");
  if (!db.startsWith(runtime + sep)) throw new Error("DB outside fake runtime");
  for (const candidate of [db, db + "-wal", db + "-shm"]) {
    if (
      existsSync(candidate) &&
      (lstatSync(candidate).isSymbolicLink() || !lstatSync(candidate).isFile())
    )
      throw new Error("Unsafe fake DB path");
  }
  return db;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) ===
    realpathSync(new URL(import.meta.url).pathname)
) {
  const repo = process.cwd();
  const runtime = resolve(repo, "..", "OpenStudyHub-v2-runtime");
  const dbPath = validateFakeReset({
    repo,
    runtime,
    dbPath: join(runtime, "data", "v2-fake.db"),
    nodeEnv: process.env.NODE_ENV,
    consent: process.env.OPENSTUDYHUB_V2_RESET,
    args: process.argv.slice(2),
  });
  for (const path of [dbPath, dbPath + "-wal", dbPath + "-shm"])
    if (existsSync(path)) rmSync(path);
  const fakeHash = await hashPassword("FicticioLocal!2030");
  const db = openV2Database(dbPath);
  try {
    migrateV2(db);
    seedV2Fake(db, fakeHash);
  } finally {
    db.close();
  }
  console.log("Fake V2 runtime reset completed.");
}
