import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "@/lib/env";

import {
  getGoogleIntegrationAvailability,
  GOOGLE_OAUTH_SCOPES,
} from "./config";

describe("Google integration configuration", () => {
  it("permanece opcional quando não configurada", () => {
    expect(
      getGoogleIntegrationAvailability(parseServerEnvironment({})),
    ).toEqual({
      configured: false,
      missing: [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "GOOGLE_TOKEN_ENCRYPTION_KEY",
      ],
    });
  });

  it("valida a configuração completa sem expor valores", () => {
    const availability = getGoogleIntegrationAvailability(
      parseServerEnvironment({
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_REDIRECT_URI: "http://localhost:3000/api/google/callback",
        GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      }),
    );
    expect(availability.configured).toBe(true);
  });

  it("informa somente o nome da chave inválida", () => {
    expect(
      getGoogleIntegrationAvailability(
        parseServerEnvironment({
          GOOGLE_CLIENT_ID: "client-id",
          GOOGLE_CLIENT_SECRET: "client-secret",
          GOOGLE_REDIRECT_URI: "http://localhost:3000/api/google/callback",
          GOOGLE_TOKEN_ENCRYPTION_KEY: "valor-privado-invalido",
        }),
      ),
    ).toEqual({
      configured: false,
      missing: ["GOOGLE_TOKEN_ENCRYPTION_KEY"],
    });
  });

  it("desabilita redirect inválido sem derrubar o Core nem expor o valor", () => {
    expect(
      getGoogleIntegrationAvailability(
        parseServerEnvironment({
          GOOGLE_CLIENT_ID: "client-id",
          GOOGLE_CLIENT_SECRET: "client-secret",
          GOOGLE_REDIRECT_URI: "valor-privado-invalido",
          GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        }),
      ),
    ).toEqual({
      configured: false,
      missing: ["GOOGLE_REDIRECT_URI"],
    });
  });

  it("solicita somente scopes Google explicitamente lidos pela fase", () => {
    expect(GOOGLE_OAUTH_SCOPES).toContain(
      "https://www.googleapis.com/auth/drive.file",
    );
    expect(
      GOOGLE_OAUTH_SCOPES.every((scope) => !scope.includes(".write")),
    ).toBe(true);
    expect(GOOGLE_OAUTH_SCOPES).not.toContain(
      "https://www.googleapis.com/auth/drive",
    );
    expect(GOOGLE_OAUTH_SCOPES).not.toContain(
      "https://www.googleapis.com/auth/classroom.coursework.students",
    );
  });
});
