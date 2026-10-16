import { createECDH } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import webpush from "web-push";
import { v2RuntimePath } from "./runtime-database";
export type PushConfiguration = {
  publicKey: string;
  privateKey: string;
  subject: string;
};
function configPath() {
  return join(dirname(v2RuntimePath()), "push-control", "vapid.json");
}
export function validPushConfiguration(value: PushConfiguration) {
  try {
    if (
      !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(
        value.subject,
      )
    )
      return false;
    const publicKey = Buffer.from(value.publicKey, "base64url"),
      privateKey = Buffer.from(value.privateKey, "base64url");
    if (publicKey.length !== 65 || privateKey.length !== 32) return false;
    const curve = createECDH("prime256v1");
    curve.setPrivateKey(privateKey);
    return curve.getPublicKey().equals(publicKey);
  } catch {
    return false;
  }
}
export function managedPushConfiguration(): PushConfiguration | null {
  try {
    if (!existsSync(configPath())) return null;
    const value = JSON.parse(readFileSync(configPath(), "utf8"));
    return validPushConfiguration(value) ? value : null;
  } catch {
    return null;
  }
}
export function generatePushConfiguration(subject: string) {
  if (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.VAPID_PRIVATE_KEY ||
    process.env.VAPID_SUBJECT
  )
    throw new Error(
      "As chaves são gerenciadas pelo ambiente. Revise VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT na instalação.",
    );
  if (existsSync(configPath()))
    throw new Error(
      "As chaves desta instância já foram criadas e foram mantidas.",
    );
  const keys = webpush.generateVAPIDKeys(),
    value = { ...keys, subject: subject.trim() };
  if (!validPushConfiguration(value))
    throw new Error(
      "Informe um contato válido: mailto:admin@instituicao.edu ou uma página HTTPS.",
    );
  const folder = dirname(configPath());
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  if (realpathSync(folder) !== resolve(folder))
    throw new Error("Diretório de configuração inválido.");
  writeFileSync(configPath(), JSON.stringify(value), {
    flag: "wx",
    mode: 0o600,
  });
}
