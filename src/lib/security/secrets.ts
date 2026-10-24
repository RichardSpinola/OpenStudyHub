import { createHmac } from "node:crypto";
import {
  encryptSecret,
  decryptSecret,
  parseEncryptionKey,
} from "@/lib/google/crypto";

export function instanceKey(purpose: "admin-mfa" | "local-ai") {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!value)
    throw new Error(
      "Configure a chave de criptografia da instância. / Configure the instance encryption key.",
    );
  return createHmac("sha256", parseEncryptionKey(value))
    .update(`OpenStudyHub:${purpose}:v1`)
    .digest();
}
export const seal = (value: string, purpose: "admin-mfa" | "local-ai") =>
  encryptSecret(value, instanceKey(purpose));
export const unseal = (value: string, purpose: "admin-mfa" | "local-ai") =>
  decryptSecret(value, instanceKey(purpose));
