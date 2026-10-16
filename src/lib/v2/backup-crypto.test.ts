import { it, expect } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { encryptBackup, decryptBackup, recoveryKey } from "./backup-crypto";
it("roundtrips an encrypted stream and rejects wrong keys and corrupted files without leaving plaintext", async () => {
  const dir = mkdtempSync(join(tmpdir(), "osh-crypto-"));
  try {
    const source = join(dir, "source"),
      encrypted = join(dir, "encrypted"),
      restored = join(dir, "restored"),
      bad = join(dir, "bad");
    const bytes = Buffer.alloc(2 * 1024 * 1024, 0x37),
      key = recoveryKey();
    writeFileSync(source, bytes);
    await encryptBackup(source, encrypted, key);
    expect(readFileSync(encrypted).includes(bytes.subarray(0, 100))).toBe(
      false,
    );
    await decryptBackup(encrypted, restored, key);
    expect(readFileSync(restored).equals(bytes)).toBe(true);
    await expect(decryptBackup(encrypted, bad, recoveryKey())).rejects.toThrow(
      "Chave incorreta",
    );
    expect(existsSync(bad)).toBe(false);
    const corrupted = readFileSync(encrypted);
    corrupted[40] ^= 1;
    writeFileSync(encrypted, corrupted);
    await expect(decryptBackup(encrypted, bad, key)).rejects.toThrow(
      "danificado",
    );
    expect(existsSync(bad)).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
