import { describe, expect, it } from "vitest";

import { getTranslations } from "./translations";

describe("academic translations", () => {
  it("expõe o catálogo acadêmico em pt-BR e en", () => {
    const portuguese = getTranslations("pt-BR").academic;
    const english = getTranslations("en").academic;

    expect(portuguese.subjectsTitle).toBe("DISCIPLINAS");
    expect(portuguese.scheduleTitle).toBe("AGENDA");
    expect(portuguese.timelineTitle).toBe("TIMELINE");
    expect(english.subjectsTitle).toBe("SUBJECTS");
    expect(english.scheduleTitle).toBe("SCHEDULE");
    expect(english.timelineTitle).toBe("TIMELINE");
    expect(Object.keys(english)).toEqual(Object.keys(portuguese));
  });
});
