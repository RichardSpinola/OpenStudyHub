import { describe, expect, it } from "vitest";

import {
  resolveAcademicSettingsSection,
  resolveSettingsSection,
} from "./settings-navigation";

describe("navegação contextual de configurações", () => {
  it("preserva a seção pessoal endereçada e bloqueia panes administrativas", () => {
    const personal = {
      instance: false,
      administration: false,
      storage: false,
    };
    expect(resolveSettingsSection("personalization", personal)).toBe(
      "personalization",
    );
    expect(resolveSettingsSection("google", personal)).toBe("google");
    expect(resolveSettingsSection("administration", personal)).toBe("profile");
    expect(resolveSettingsSection("storage", personal)).toBe("profile");
  });

  it("mantém deep links permitidos de instância e administração", () => {
    const admin = { instance: true, administration: true, storage: true };
    expect(resolveSettingsSection("instance", admin)).toBe("instance");
    expect(resolveSettingsSection("administration", admin)).toBe(
      "administration",
    );
    expect(resolveSettingsSection("storage", admin)).toBe("storage");
  });

  it("limita subseções acadêmicas à autoridade já existente", () => {
    expect(
      resolveAcademicSettingsSection("programs", {
        global: false,
        program: false,
      }),
    ).toBe("cohorts");
    expect(
      resolveAcademicSettingsSection("integrations", {
        global: false,
        program: true,
      }),
    ).toBe("integrations");
    expect(
      resolveAcademicSettingsSection("subjects", {
        global: true,
        program: true,
      }),
    ).toBe("subjects");
  });
});
