import { describe, expect, it } from "vitest";

import { defaultNotificationPreferences } from "./notifications";

describe("notification defaults", () => {
  it("notifica novas conversas em todos os tipos por padrão", () => {
    expect(defaultNotificationPreferences).toMatchObject({
      dm: "all",
      groupDefault: "all",
      audienceDefault: "all",
      mentionsEnabled: true,
      repliesEnabled: true,
    });
  });
});
