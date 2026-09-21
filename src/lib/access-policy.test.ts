import { describe, expect, it } from "vitest";

import { canAccessAdministration } from "./access-policy";
import {
  DEVELOPMENT_RESET_CONFIRMATION,
  DEVELOPMENT_RESET_ENV_VALUE,
  validateDevelopmentReset,
} from "./development-reset";

describe("política administrativa", () => {
  it("permite apenas admin autenticado", () => {
    expect(canAccessAdministration(null)).toBe(false);
    expect(
      canAccessAdministration({
        id: 1,
        displayName: "Membro",
        login: "membro",
        role: "member",
      }),
    ).toBe(false);
    expect(
      canAccessAdministration({
        id: 2,
        displayName: "Admin",
        login: "admin",
        role: "admin",
      }),
    ).toBe(true);
  });
});

describe("proteção do reset de desenvolvimento", () => {
  const valid = {
    nodeEnvironment: "development",
    confirmationValue: DEVELOPMENT_RESET_ENV_VALUE,
    arguments: [DEVELOPMENT_RESET_CONFIRMATION],
    databasePath: "./data/test-reset.db",
    projectDirectory: "/workspace/openstudyhub",
  };

  it("exige todas as confirmações e restringe o caminho", () => {
    expect(validateDevelopmentReset(valid)).toBe(
      "/workspace/openstudyhub/data/test-reset.db",
    );
    expect(() =>
      validateDevelopmentReset({ ...valid, nodeEnvironment: "production" }),
    ).toThrow();
    expect(() =>
      validateDevelopmentReset({ ...valid, confirmationValue: undefined }),
    ).toThrow();
    expect(() =>
      validateDevelopmentReset({ ...valid, arguments: [] }),
    ).toThrow();
    expect(() =>
      validateDevelopmentReset({
        ...valid,
        databasePath: "/var/lib/production.db",
      }),
    ).toThrow();
  });
});
