import { getServerEnvironment, type ServerEnvironment } from "@/lib/env";
import { parseEncryptionKey } from "@/lib/google/crypto";
import {
  GOOGLE_CLASSROOM_ANNOUNCEMENTS_SCOPE,
  GOOGLE_CLASSROOM_COURSES_SCOPE,
  GOOGLE_CLASSROOM_COURSEWORK_SCOPE,
  GOOGLE_CLASSROOM_MATERIALS_SCOPE,
  GOOGLE_DRIVE_FILE_SCOPE,
} from "@/lib/google/config";

export const CLASSROOM_SCOPES = [
  "openid",
  "email",
  GOOGLE_CLASSROOM_COURSES_SCOPE,
  GOOGLE_CLASSROOM_COURSEWORK_SCOPE,
  GOOGLE_CLASSROOM_MATERIALS_SCOPE,
  GOOGLE_CLASSROOM_ANNOUNCEMENTS_SCOPE,
] as const;
export const DRIVE_SCOPE = GOOGLE_DRIVE_FILE_SCOPE;
export const GOOGLE_V2_CALLBACK = "/api/v2/google/callback";

export type GoogleV2Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};
export type GoogleV2Diagnostic = {
  appUrlConfigured: boolean;
  appOrigin: string | null;
  expectedRedirectUri: string | null;
  redirectUri: string | null;
  httpsExpected: boolean;
  clientConfigured: boolean;
  encryptionKeyConfigured: boolean;
  errors: string[];
};

export function inspectGoogleV2Config(
  environment: ServerEnvironment = getServerEnvironment(),
  explicitAppUrl = !!process.env.APP_URL,
): { diagnostic: GoogleV2Diagnostic; config: GoogleV2Config | null } {
  const errors: string[] = [];
  let appOrigin: string | null = null;
  let expectedRedirectUri: string | null = null;
  let redirectUri: string | null = null;
  let encryptionKey: Buffer | null = null;
  try {
    const url = new URL(environment.APP_URL);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/" ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new Error();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !local)
      errors.push("APP_URL precisa usar HTTPS fora do ambiente local.");
    if (!explicitAppUrl && environment.NODE_ENV === "production")
      errors.push("Defina APP_URL explicitamente em produção.");
    appOrigin = url.origin;
    expectedRedirectUri = url.origin + GOOGLE_V2_CALLBACK;
  } catch {
    errors.push(
      "APP_URL deve ser uma origem HTTP(S) válida, sem caminho ou credenciais.",
    );
  }
  if (environment.GOOGLE_REDIRECT_URI) {
    try {
      redirectUri = new URL(environment.GOOGLE_REDIRECT_URI).toString();
    } catch {
      errors.push("GOOGLE_REDIRECT_URI inválida.");
    }
  } else errors.push("Defina GOOGLE_REDIRECT_URI para o callback V2.");
  if (expectedRedirectUri && redirectUri !== expectedRedirectUri)
    errors.push(
      "GOOGLE_REDIRECT_URI deve coincidir com APP_URL + " +
        GOOGLE_V2_CALLBACK +
        ".",
    );
  if (!environment.GOOGLE_CLIENT_ID || !environment.GOOGLE_CLIENT_SECRET)
    errors.push("Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");
  try {
    if (environment.GOOGLE_TOKEN_ENCRYPTION_KEY)
      encryptionKey = parseEncryptionKey(
        environment.GOOGLE_TOKEN_ENCRYPTION_KEY,
      );
  } catch {
    // Only the field name is reported.
  }
  if (!encryptionKey)
    errors.push("Configure GOOGLE_TOKEN_ENCRYPTION_KEY válida.");
  const diagnostic = {
    appUrlConfigured: explicitAppUrl,
    appOrigin,
    expectedRedirectUri,
    redirectUri,
    httpsExpected:
      !!appOrigin &&
      !appOrigin.startsWith("http://localhost") &&
      !appOrigin.startsWith("http://127.0.0.1"),
    clientConfigured:
      !!environment.GOOGLE_CLIENT_ID && !!environment.GOOGLE_CLIENT_SECRET,
    encryptionKeyConfigured: !!encryptionKey,
    errors,
  };
  return {
    diagnostic,
    config:
      errors.length || !redirectUri || !encryptionKey
        ? null
        : {
            clientId: environment.GOOGLE_CLIENT_ID!,
            clientSecret: environment.GOOGLE_CLIENT_SECRET!,
            redirectUri,
            encryptionKey,
          },
  };
}

export function requireGoogleV2Config(): GoogleV2Config {
  const result = inspectGoogleV2Config();
  if (!result.config) throw new Error(result.diagnostic.errors.join(" "));
  return result.config;
}
