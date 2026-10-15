import { describe, it, expect } from "vitest";
import { sameNoteRequestOrigin } from "./note-request-origin";
describe("note API origin", () => {
  it("accepts the browser destination even when Next's internal URL uses a different listen hostname", () => {
    expect(
      sameNoteRequestOrigin(
        new Headers({
          origin: "http://127.0.0.1:3090",
          host: "127.0.0.1:3090",
        }),
      ),
    ).toBe(true);
    expect(
      sameNoteRequestOrigin(
        new Headers({ origin: "https://hub.example", host: "hub.example" }),
      ),
    ).toBe(true);
  });
  it("rejects foreign origins, missing origins and misleading host suffixes", () => {
    expect(
      sameNoteRequestOrigin(
        new Headers({ origin: "https://evil.example", host: "hub.example" }),
      ),
    ).toBe(false);
    expect(sameNoteRequestOrigin(new Headers({ host: "hub.example" }))).toBe(
      false,
    );
    expect(
      sameNoteRequestOrigin(
        new Headers({
          origin: "https://hub.example.evil.example",
          host: "hub.example",
        }),
      ),
    ).toBe(false);
  });
});
