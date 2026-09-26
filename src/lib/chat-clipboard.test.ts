import { describe, expect, it } from "vitest";
import { pastedChatImage } from "./chat-clipboard";

describe("colagem de imagem no Chat", () => {
  it("aceita screenshot e preserva texto colado junto", () => {
    const file = new File([new Uint8Array([1, 2, 3])], "screenshot.png", {
      type: "image/png",
    });
    expect(
      pastedChatImage([
        { kind: "string", type: "text/plain", getAsFile: () => null },
        { kind: "file", type: "image/png", getAsFile: () => file },
      ]),
    ).toMatchObject({ file, hasText: true, invalidImage: false });
  });

  it("recusa imagem acima do limite", () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
      type: "image/png",
    });
    expect(
      pastedChatImage([
        { kind: "file", type: "image/png", getAsFile: () => file },
      ]),
    ).toMatchObject({ file: null, invalidImage: true });
  });
});
