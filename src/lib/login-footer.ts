import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "@/lib/db/client";

export const LOGIN_FOOTER_KEY = "login.footer";
const footerUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "mailto:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use um link HTTPS ou mailto: válido.");
export const loginFooterSchema = z.object({
  enabled: z.boolean(),
  text: z.string().trim().max(600),
  links: z
    .array(
      z.object({ label: z.string().trim().min(1).max(60), url: footerUrl }),
    )
    .max(4),
});
export type LoginFooterConfig = z.infer<typeof loginFooterSchema>;
export const defaultLoginFooter: LoginFooterConfig = {
  enabled: true,
  text: "OpenStudyHub é um projeto independente para estudantes, sem vínculo oficial com a instituição de ensino.",
  links: [
    {
      label: "Projeto OpenStudyHub",
      url: "https://github.com/RichardSpinola/OpenStudyHub",
    },
  ],
};
export function getLoginFooter(
  connection: DatabaseConnection = getDatabase(),
): LoginFooterConfig {
  const row = connection.sqlite
    .prepare("SELECT value FROM app_settings WHERE key=?")
    .get(LOGIN_FOOTER_KEY) as { value: string } | undefined;
  try {
    return row
      ? loginFooterSchema.parse(JSON.parse(row.value))
      : defaultLoginFooter;
  } catch {
    return defaultLoginFooter;
  }
}
export function saveLoginFooter(
  input: unknown,
  connection: DatabaseConnection = getDatabase(),
) {
  const config = loginFooterSchema.parse(input);
  connection.sqlite
    .prepare(
      `INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`,
    )
    .run(LOGIN_FOOTER_KEY, JSON.stringify(config), Date.now());
  return config;
}
