import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("credenciais locais", () => {
  it("armazena Argon2id com salt e verifica sem texto puro", async () => {
    const password = "senha-local-forte-123";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).toMatch(/^\$argon2id\$/u);
    expect(first).not.toContain(password);
    expect(second).not.toBe(first);
    await expect(verifyPassword(first, password)).resolves.toBe(true);
    await expect(verifyPassword(first, "senha-incorreta")).resolves.toBe(false);
  });

  it("recusa senhas fora dos limites", async () => {
    await expect(hashPassword("curta")).rejects.toThrow();
    await expect(hashPassword("x".repeat(129))).rejects.toThrow();
  });
});
