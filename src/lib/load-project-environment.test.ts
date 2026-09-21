import { describe, expect, it } from "vitest";

import { isDevelopmentEnvironment } from "./load-project-environment";

describe("isDevelopmentEnvironment", () => {
  it.each([
    ["development", true],
    ["test", false],
    ["production", false],
    [undefined, false],
  ])("interpreta NODE_ENV=%s", (nodeEnvironment, expected) => {
    expect(isDevelopmentEnvironment(nodeEnvironment)).toBe(expected);
  });
});
