import { describe, it, expect } from "vitest";
import { shortcutPresetFor } from "./shortcut-icon-catalog";
describe("shortcut icon choices", () => {
  it("recognizes exact known hosts without assigning their brand to lookalikes", () => {
    expect(shortcutPresetFor("https://mail.google.com/mail", null)).toBe(
      "gmail",
    );
    expect(shortcutPresetFor("https://github.com/user", "GH")).toBe("github");
    expect(
      shortcutPresetFor("https://github.com.example.test/", null),
    ).toBeNull();
    expect(shortcutPresetFor("not a url", null)).toBeNull();
  });
  it("lets the user's preset or favicon choice override automatic recognition", () => {
    expect(shortcutPresetFor("https://github.com/", "@book")).toBe("book");
    expect(shortcutPresetFor("https://github.com/", "@site")).toBeNull();
    expect(shortcutPresetFor("https://unknown.example.test/", null)).toBeNull();
  });
});
