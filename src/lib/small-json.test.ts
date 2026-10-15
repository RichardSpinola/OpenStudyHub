import { it, expect } from "vitest";
import { readSmallJson } from "./small-json";
it("limits chunked request bodies before parsing", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("x".repeat(100)));
      c.close();
    },
  });
  await expect(
    readSmallJson(
      new Request("http://localhost", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
      20,
    ),
  ).rejects.toThrow("grandes");
  expect(
    await readSmallJson(
      new Request("http://localhost", { method: "POST", body: '{"ok":true}' }),
    ),
  ).toEqual({ ok: true });
});
