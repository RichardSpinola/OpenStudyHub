import { z } from "zod";

const optionalEnvironmentText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

export const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  APP_NAME: z.string().trim().min(1).default("OpenStudyHub"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_PATH: z.string().trim().min(1).default("./data/openstudyhub.db"),
  PRIVATE_ASSET_PATH: z.string().trim().min(1).default("./data/private-assets"),
  GOOGLE_CLIENT_ID: optionalEnvironmentText,
  GOOGLE_CLIENT_SECRET: optionalEnvironmentText,
  GOOGLE_REDIRECT_URI: optionalEnvironmentText,
  GOOGLE_TOKEN_ENCRYPTION_KEY: optionalEnvironmentText,
  GOOGLE_TEMPLATE_GENERIC_ACTIVITY_ID: optionalEnvironmentText,
  GOOGLE_TEMPLATE_PROGRAMMING_ACTIVITY_ID: optionalEnvironmentText,
  GOOGLE_TEMPLATE_CLASS_NOTES_ID: optionalEnvironmentText,
  GOOGLE_PICKER_API_KEY: optionalEnvironmentText,
  GOOGLE_CLOUD_PROJECT_NUMBER: optionalEnvironmentText,
  CLASSROOM_SYNC_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(1440)
    .default(15),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function parseServerEnvironment(
  source: Record<string, string | undefined>,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(source);

  if (!result.success) {
    const invalidFields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Configuração de ambiente inválida${invalidFields ? `: ${invalidFields}` : ""}.`,
    );
  }

  return result.data;
}

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
