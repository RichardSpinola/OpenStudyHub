import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, parseEncryptionKey } from "./crypto";

describe("Google secret encryption", () => {
  it("cifra e autentica o valor com AES-256-GCM", () => {
    const key = randomBytes(32);
    const encrypted = encryptSecret("refresh-token-private", key);

    expect(encrypted).not.toContain("refresh-token-private");
    expect(encryptSecret("refresh-token-private", key)).not.toBe(encrypted);
    expect(decryptSecret(encrypted, key)).toBe("refresh-token-private");
    expect(() => decryptSecret(encrypted, randomBytes(32))).toThrow(
      "Secret decryption failed.",
    );
    const parts = encrypted.split(".");
    parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    expect(() => decryptSecret(parts.join("."), key)).toThrow(
      "Secret decryption failed.",
    );
  });

  it("aceita somente chave base64 canônica de 32 bytes", () => {
    const encoded = randomBytes(32).toString("base64");
    expect(parseEncryptionKey(encoded)).toHaveLength(32);
    expect(() => parseEncryptionKey("short-private-value")).toThrow(
      "Invalid Google token encryption key.",
    );
  });
});
