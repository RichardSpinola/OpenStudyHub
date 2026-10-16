import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { open, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
const magic = Buffer.from("OSHBACKUP1\n");
export function recoveryKey() {
  return randomBytes(32).toString("base64url");
}
function keyBytes(key: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(key))
    throw new Error("Chave de recuperação inválida.");
  const bytes = Buffer.from(key, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== key)
    throw new Error("Chave de recuperação inválida.");
  return bytes;
}
export async function encryptBackup(
  source: string,
  target: string,
  key: string,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const file = await open(target, "wx", 0o600);
  try {
    await file.write(Buffer.concat([magic, iv]));
  } finally {
    await file.close();
  }
  try {
    await pipeline(
      createReadStream(source),
      cipher,
      createWriteStream(target, { flags: "a", mode: 0o600 }),
    );
    const tail = await open(target, "a");
    try {
      await tail.write(cipher.getAuthTag());
    } finally {
      await tail.close();
    }
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
}
export async function decryptBackup(
  source: string,
  target: string,
  key: string,
) {
  const file = await open(source, "r");
  const header = Buffer.alloc(magic.length + 12),
    tag = Buffer.alloc(16);
  let size: number;
  try {
    size = (await file.stat()).size;
    if (size < header.length + 16) throw new Error("Backup inválido.");
    await file.read(header, 0, header.length, 0);
    await file.read(tag, 0, 16, size - 16);
    if (!header.subarray(0, magic.length).equals(magic))
      throw new Error("Formato de backup inválido.");
  } finally {
    await file.close();
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyBytes(key),
    header.subarray(magic.length),
  );
  decipher.setAuthTag(tag);
  try {
    await pipeline(
      createReadStream(source, { start: header.length, end: size! - 17 }),
      decipher,
      createWriteStream(target, { flags: "wx", mode: 0o600 }),
    );
  } catch {
    await rm(target, { force: true });
    throw new Error(
      "Chave incorreta ou backup danificado. Nenhum dado foi restaurado.",
    );
  }
}
