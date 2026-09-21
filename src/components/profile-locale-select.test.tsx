import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProfileLocaleSelect } from "./profile-locale-select";

describe("seletor de locale do perfil", () => {
  it.each([
    ["pt-BR", "Português (Brasil)"],
    ["en", "English"],
  ] as const)(
    "reflete o locale persistido %s após renderização",
    (locale, selectedLabel) => {
      const html = renderToStaticMarkup(
        <ProfileLocaleSelect label="Idioma" locale={locale} />,
      );

      expect(html).toContain(
        `<option value="${locale}" selected="">${selectedLabel}</option>`,
      );
    },
  );
});
