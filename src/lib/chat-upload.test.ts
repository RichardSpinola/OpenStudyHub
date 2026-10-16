import { it, expect } from "vitest";
import { readBoundedFormData } from "./chat-upload";
it("parses multipart incrementally and rejects oversized declared or streamed bodies", async () => {
  const form = new FormData();
  form.set("body", "teste");
  form.set("file", new File(["arquivo"], "teste.txt"));
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: form,
  });
  const data = await readBoundedFormData(request, 4096);
  expect(data.get("body")).toBe("teste");
  expect(await (data.get("file") as File).text()).toBe("arquivo");
  await expect(
    readBoundedFormData(
      new Request("http://localhost/upload", {
        method: "POST",
        body: "a",
        headers: { "content-length": "100" },
      }),
      10,
    ),
  ).rejects.toThrow("grande demais");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(20));
      controller.close();
    },
  });
  await expect(
    readBoundedFormData(
      new Request("http://localhost/upload", {
        method: "POST",
        body: stream,
        duplex: "half",
        headers: { "content-type": "multipart/form-data; boundary=test" },
      } as RequestInit),
      10,
    ),
  ).rejects.toThrow();
});
