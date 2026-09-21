import { argon2id, hash, verify } from "argon2";
import { z } from "zod";

export const localPasswordSchema = z
  .string()
  .min(12, "A senha local deve ter pelo menos 12 caracteres.")
  .max(128, "A senha local deve ter no máximo 128 caracteres.");

let dummyHashPromise: Promise<string> | undefined;

export async function hashPassword(password: string): Promise<string> {
  const validatedPassword = localPasswordSchema.parse(password);
  return hash(validatedPassword, { type: argon2id });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hash("invalid-login-timing-sentinel", {
    type: argon2id,
  });
  return dummyHashPromise;
}
