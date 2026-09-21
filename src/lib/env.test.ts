import { describe, expect, it } from "vitest";

import { parseServerEnvironment } from "./env";

describe("parseServerEnvironment", () => {
  it("aplica defaults sem inventar NODE_ENV", () => {
    expect(parseServerEnvironment({})).toEqual({
      APP_NAME: "OpenStudyHub",
      APP_URL: "http://localhost:3000",
      CLASSROOM_SYNC_TTL_MINUTES: 15,
      DATABASE_PATH: "./data/openstudyhub.db",
      PRIVATE_ASSET_PATH: "./data/private-assets",
    });
  });

  it("rejeita uma URL inválida sem expor seu valor", () => {
    expect(() => parseServerEnvironment({ APP_URL: "não-é-uma-url" })).toThrow(
      "Configuração de ambiente inválida: APP_URL.",
    );
  });

  it("normaliza configuração Google vazia como opcional", () => {
    expect(
      parseServerEnvironment({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "  ",
        GOOGLE_REDIRECT_URI: "",
        GOOGLE_TOKEN_ENCRYPTION_KEY: "",
      }),
    ).toEqual({
      APP_NAME: "OpenStudyHub",
      APP_URL: "http://localhost:3000",
      CLASSROOM_SYNC_TTL_MINUTES: 15,
      DATABASE_PATH: "./data/openstudyhub.db",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REDIRECT_URI: undefined,
      GOOGLE_TOKEN_ENCRYPTION_KEY: undefined,
      PRIVATE_ASSET_PATH: "./data/private-assets",
    });
  });
});
