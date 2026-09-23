import type { ServerEnvironment } from "@/lib/env";
import { getServerEnvironment } from "@/lib/env";

import { parseEncryptionKey } from "./crypto";

export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_CLASSROOM_COURSES_SCOPE =
  "https://www.googleapis.com/auth/classroom.courses.readonly";
export const GOOGLE_CLASSROOM_COURSEWORK_SCOPE =
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly";
export const GOOGLE_CLASSROOM_MATERIALS_SCOPE =
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly";
export const GOOGLE_CLASSROOM_ANNOUNCEMENTS_SCOPE =
  "https://www.googleapis.com/auth/classroom.announcements.readonly";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_CLASSROOM_COURSES_SCOPE,
  GOOGLE_CLASSROOM_COURSEWORK_SCOPE,
  GOOGLE_CLASSROOM_MATERIALS_SCOPE,
  GOOGLE_CLASSROOM_ANNOUNCEMENTS_SCOPE,
] as const;

export type GoogleIntegrationConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};

export type GoogleIntegrationAvailability =
  | { configured: true; config: GoogleIntegrationConfig }
  | { configured: false; missing: string[] };

export function getGoogleIntegrationAvailability(
  environment: ServerEnvironment = getServerEnvironment(),
): GoogleIntegrationAvailability {
  const missing = new Set<string>();
  let expectedRedirect: string | null = null;
  try {
    const appUrl = new URL(environment.APP_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname);
    if (
      appUrl.username ||
      appUrl.password ||
      appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash ||
      (appUrl.protocol !== "https:" && !local) ||
      (environment.NODE_ENV === "production" && !process.env.APP_URL)
    )
      throw new Error();
    expectedRedirect = appUrl.origin + "/api/google/callback";
  } catch {
    missing.add("APP_URL");
  }
  if (!environment.GOOGLE_CLIENT_ID) missing.add("GOOGLE_CLIENT_ID");
  if (!environment.GOOGLE_CLIENT_SECRET) missing.add("GOOGLE_CLIENT_SECRET");
  let redirectUri: string | null = null;
  if (!environment.GOOGLE_REDIRECT_URI) {
    missing.add("GOOGLE_REDIRECT_URI");
  } else {
    try {
      const candidate = new URL(environment.GOOGLE_REDIRECT_URI);
      if (candidate.protocol !== "https:" && candidate.protocol !== "http:") {
        throw new Error();
      }
      redirectUri = candidate.toString();
      if (expectedRedirect && redirectUri !== expectedRedirect)
        throw new Error();
    } catch {
      missing.add("GOOGLE_REDIRECT_URI");
    }
  }

  let encryptionKey: Buffer | null = null;
  if (!environment.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    missing.add("GOOGLE_TOKEN_ENCRYPTION_KEY");
  } else {
    try {
      encryptionKey = parseEncryptionKey(
        environment.GOOGLE_TOKEN_ENCRYPTION_KEY,
      );
    } catch {
      missing.add("GOOGLE_TOKEN_ENCRYPTION_KEY");
    }
  }

  if (missing.size > 0 || !encryptionKey || !redirectUri) {
    return { configured: false, missing: [...missing] };
  }

  return {
    configured: true,
    config: {
      clientId: environment.GOOGLE_CLIENT_ID!,
      clientSecret: environment.GOOGLE_CLIENT_SECRET!,
      redirectUri,
      encryptionKey,
    },
  };
}

export function requireGoogleIntegrationConfig(): GoogleIntegrationConfig {
  const availability = getGoogleIntegrationAvailability();
  if (!availability.configured) {
    throw new Error("Google integration is not configured.");
  }
  return availability.config;
}

export type GooglePickerConfig = {
  apiKey: string;
  appId: string;
};

export function getGooglePickerConfig(
  environment: ServerEnvironment = getServerEnvironment(),
): GooglePickerConfig | null {
  if (
    !environment.GOOGLE_PICKER_API_KEY ||
    !environment.GOOGLE_CLOUD_PROJECT_NUMBER
  )
    return null;
  return {
    apiKey: environment.GOOGLE_PICKER_API_KEY,
    appId: environment.GOOGLE_CLOUD_PROJECT_NUMBER,
  };
}
