import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function parseEncryptionKey(value: string): Buffer {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(normalized)) {
    throw new Error("Invalid Google token encryption key.");
  }
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64") !== normalized) {
    throw new Error("Invalid Google token encryption key.");
  }
  return key;
}

export function encryptSecret(value: string, key: Buffer): string {
  if (!value || key.length !== 32) throw new Error("Secret encryption failed.");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string, key: Buffer): string {
  try {
    const [version, ivValue, encryptedValue, tagValue, extra] =
      value.split(".");
    if (
      version !== ENCRYPTION_VERSION ||
      !ivValue ||
      !encryptedValue ||
      !tagValue ||
      extra
    ) {
      throw new Error();
    }
    const iv = Buffer.from(ivValue, "base64url");
    const encrypted = Buffer.from(encryptedValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Secret decryption failed.");
  }
}
