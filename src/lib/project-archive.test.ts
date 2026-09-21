import { describe, expect, it } from "vitest";

import { createProjectZip, readProjectZip } from "@/lib/project-archive";

describe("project ZIP", () => {
  it("preserva uma árvore de arquivos válida", async () => {
    const archive = await createProjectZip([
      { path: "src/main.ts", data: Buffer.from("export {}") },
      { path: "README.md", data: Buffer.from("# Demo") },
    ]);
    const files = await readProjectZip(archive);
    expect(files.map(({ path }) => path)).toEqual(["src/main.ts", "README.md"]);
    expect(files[0].data.toString()).toBe("export {}");
  });

  it("rejeita ZIP slip antes de extrair", async () => {
    await expect(
      createProjectZip([{ path: "../escape.txt", data: Buffer.from("bad") }]),
    ).rejects.toThrow();
  });
});
