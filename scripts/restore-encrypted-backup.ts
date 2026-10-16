// Offline restore of authenticated encrypted packages. Never pass the key in argv.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { decryptBackup } from "../src/lib/v2/backup-crypto";
const args = process.argv.slice(2),
  source = args[0],
  keyIndex = args.indexOf("--key-file");
const validate = args.includes("--validate-only"),
  confirmed = args.includes("--confirm-restore"),
  stopped = args.includes("--services-stopped");
if (
  !source ||
  keyIndex < 1 ||
  !args[keyIndex + 1] ||
  (!validate && (!confirmed || !stopped))
) {
  console.error(
    "Uso: node --import tsx scripts/restore-encrypted-backup.ts backup.oshbackup --key-file /local/recovery.key --validate-only OU --confirm-restore --services-stopped. Configure os três caminhos de dados no ambiente.",
  );
  process.exit(2);
}
const folder = mkdtempSync(join(tmpdir(), "osh-decrypt-")),
  target = join(folder, "verified.zip");
try {
  // A downloaded key file can contain the explanatory heading and footer.
  const key = readFileSync(args[keyIndex + 1], "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => /^[A-Za-z0-9_-]{43}$/.test(s));
  if (!key) throw new Error("Arquivo de chave inválido.");
  await decryptBackup(source, target, key);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/restore-manual-backup.mjs",
      target,
      validate ? "--validate-only" : "--confirm-restore",
      ...(validate ? [] : ["--services-stopped"]),
    ],
    { stdio: "inherit", env: process.env },
  );
  if (result.error)
    throw new Error("Não foi possível iniciar a ferramenta de restauração.");
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Restauração falhou.");
  process.exitCode = 1;
} finally {
  rmSync(folder, { recursive: true, force: true });
}
