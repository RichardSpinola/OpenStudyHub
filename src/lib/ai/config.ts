import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { seal, unseal } from "@/lib/security/secrets";
export const aiConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.enum(["ollama", "openai"]).default("ollama"),
    endpoint: z.string().max(2048).default("http://127.0.0.1:11434"),
    model: z.string().trim().max(200).default(""),
    instructions: z
      .string()
      .max(8000)
      .default(
        "Você é o assistente de estudos do OpenStudyHub. / You are the OpenStudyHub study assistant.",
      ),
    temperature: z.number().min(0).max(2).default(0.7),
    context: z.number().int().min(1024).max(131072).default(8192),
    maxOutput: z.number().int().min(64).max(16384).default(2048),
    timeout: z.number().int().min(10).max(600).default(120),
    concurrency: z.number().int().min(1).max(4).default(1),
    queue: z.number().int().min(0).max(32).default(8),
    dailyQuota: z.number().int().min(0).max(10000).default(0), // 0 = unlimited, technical limits still apply
    groups: z.boolean().default(false),
    global: z.boolean().default(false),
    attachments: z.boolean().default(true),
    sources: z.boolean().default(true),
    vision: z.boolean().default(false),
  })
  .refine((value) => value.maxOutput + 256 < value.context, {
    message: "Reserve contexto para a entrada / Reserve context for input",
  });
export type AiConfig = z.infer<typeof aiConfigSchema>;
export function readAiConfig(connection: DatabaseConnection = getDatabase()) {
  const row = connection.sqlite
    .prepare("SELECT * FROM ai_config WHERE id=1")
    .get() as
    | {
        value_json: string;
        credential_encrypted: string | null;
        tested_hash: string | null;
        revision: number;
      }
    | undefined;
  return {
    config: aiConfigSchema.parse(row ? JSON.parse(row.value_json) : {}),
    credentialEncrypted: row?.credential_encrypted ?? null,
    testedHash: row?.tested_hash ?? null,
    revision: row?.revision ?? 0,
  };
}
export function providerKey(config: AiConfig, encrypted: string | null) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        config.provider,
        config.endpoint,
        config.model,
        config.vision,
        encrypted,
      ]),
    )
    .digest("hex");
}
export function aiCredential(encrypted: string | null) {
  return encrypted ? unseal(encrypted, "local-ai") : undefined;
}
export function saveAiConfig(
  input: unknown,
  credential: string | undefined,
  testedHash?: string,
  connection: DatabaseConnection = getDatabase(),
) {
  const config = aiConfigSchema.parse(input);
  const previous = readAiConfig(connection);
  const encrypted =
    credential === undefined
      ? previous.credentialEncrypted
      : credential
        ? seal(credential, "local-ai")
        : null;
  const key = providerKey(config, encrypted);
  const tested = testedHash ?? previous.testedHash;
  if (config.enabled && (!config.model || key !== tested))
    throw new Error(
      "Teste a conexão e o modelo antes de ativar. / Test the connection and model before enabling.",
    );
  connection.sqlite
    .transaction(() => {
      connection.sqlite
        .prepare(
          `INSERT INTO ai_config(id,value_json,credential_encrypted,tested_hash,revision) VALUES(1,?,?,?,1) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json,credential_encrypted=excluded.credential_encrypted,tested_hash=excluded.tested_hash,revision=revision+1`,
        )
        .run(JSON.stringify(config), encrypted, tested);
      // Changing provider/config or disabling invalidates in-flight generations across processes.
      connection.sqlite
        .prepare(
          "UPDATE ai_requests SET cancel_requested=1 WHERE status IN ('queued','running')",
        )
        .run();
    })
    .immediate();
  return { config, encrypted, key };
}
