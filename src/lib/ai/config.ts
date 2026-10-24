import { createHash } from "node:crypto";
import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";
import { seal, unseal } from "@/lib/security/secrets";
const modelName = z.string().trim().min(1).max(200);
const aiConfigObject = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(["ollama", "openai"]).default("ollama"),
  endpoint: z.string().max(2048).default("http://127.0.0.1:11434"),
  // Models the administrator allowed after testing; people choose among them.
  models: z.array(modelName).max(8).default([]),
  defaultModel: z.string().trim().max(200).default(""),
  chatGlobalModel: z.string().trim().max(200).default(""),
  chatGroupModel: z.string().trim().max(200).default(""),
  // Filled by the connection test: allowed models that accept images.
  visionModels: z.array(modelName).max(8).default([]),
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
  // Ollama only: minutes a model stays in memory after use; -1 keeps it loaded.
  keepAlive: z.number().int().min(-1).max(1440).default(10),
  concurrency: z.number().int().min(1).max(4).default(1),
  queue: z.number().int().min(0).max(32).default(8),
  dailyQuota: z.number().int().min(0).max(10000).default(0), // 0 = unlimited, technical limits still apply
  groups: z.boolean().default(false),
  global: z.boolean().default(false),
  attachments: z.boolean().default(true),
  sources: z.boolean().default(true),
  vision: z.boolean().default(false),
});
// 3.1.0 stored a single `model`; read it as a one-model list.
function upgradeLegacy(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const value = { ...(input as Record<string, unknown>) };
  const legacy = typeof value.model === "string" ? value.model.trim() : "";
  delete value.model;
  if (legacy && !Array.isArray(value.models)) {
    value.models = [legacy];
    value.defaultModel ??= legacy;
    if (value.vision === true) value.visionModels ??= [legacy];
  }
  return value;
}
export const aiConfigSchema = z
  .preprocess(upgradeLegacy, aiConfigObject)
  .transform((value) => {
    const models = [...new Set(value.models)];
    const pick = (model: string) =>
      models.includes(model) ? model : (models[0] ?? "");
    const defaultModel = pick(value.defaultModel);
    return {
      ...value,
      models,
      defaultModel,
      chatGlobalModel: models.includes(value.chatGlobalModel)
        ? value.chatGlobalModel
        : defaultModel,
      chatGroupModel: models.includes(value.chatGroupModel)
        ? value.chatGroupModel
        : defaultModel,
      visionModels: value.visionModels.filter((m) => models.includes(m)),
    };
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
  // A single model hashes exactly like 3.1.0, so existing tested configs stay valid.
  return createHash("sha256")
    .update(
      JSON.stringify([
        config.provider,
        config.endpoint,
        [...config.models].sort().join(","),
        config.vision,
        encrypted,
      ]),
    )
    .digest("hex");
}
/** Model for a conversation: chat rooms follow the Admin's choice, others the person's. */
export function conversationModel(
  config: AiConfig,
  conversation: {
    room_id: number | null;
    group_id: number | null;
    model?: string | null;
  },
) {
  if (conversation.room_id)
    return conversation.group_id
      ? config.chatGroupModel
      : config.chatGlobalModel;
  return allowedModel(config, conversation.model);
}
/** The model a request may use: an allowed choice, otherwise the default. */
export function allowedModel(config: AiConfig, requested?: string | null) {
  return requested && config.models.includes(requested)
    ? requested
    : config.defaultModel;
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
  if (config.enabled && (!config.models.length || key !== tested))
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
