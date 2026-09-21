import { describe, expect, it } from "vitest";

import {
  buildProjectManifest,
  diffProjectManifests,
  normalizeProjectPath,
} from "@/lib/project-manifest";

describe("project manifest", () => {
  it("preserva árvore, calcula SHA-256 e ignora cache e secrets", () => {
    const result = buildProjectManifest(
      [
        { path: "src/main.ts", data: Buffer.from("export {}") },
        { path: "node_modules/pkg/index.js", data: Buffer.from("ignored") },
        { path: ".env", data: Buffer.from("SECRET=hidden") },
        { path: ".env.example", data: Buffer.from("SECRET=") },
        { path: ".git/config", data: Buffer.from("ignored") },
      ],
      "javascript-typescript",
    );
    expect(result.manifest.files.map(({ path }) => path)).toEqual([
      ".env.example",
      "src/main.ts",
    ]);
    expect(result.manifest.files[1].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.ignored).toHaveLength(3);
  });

  it("rejeita paths absolutos, traversal, drive letters e NUL", () => {
    for (const path of ["../x", "/tmp/x", "C:\\x", "a/../../x", "a\0b"]) {
      expect(() => normalizeProjectPath(path)).toThrow();
    }
  });

  it("detecta add/modify/remove/unchanged", () => {
    const previous = buildProjectManifest(
      [
        { path: "same.txt", data: Buffer.from("same") },
        { path: "change.txt", data: Buffer.from("old") },
        { path: "remove.txt", data: Buffer.from("remove") },
      ],
      "other",
    ).manifest;
    const current = buildProjectManifest(
      [
        { path: "same.txt", data: Buffer.from("same") },
        { path: "change.txt", data: Buffer.from("new") },
        { path: "add.txt", data: Buffer.from("add") },
      ],
      "other",
    ).manifest;
    expect(diffProjectManifests(previous, current)).toEqual({
      added: ["add.txt"],
      modified: ["change.txt"],
      removed: ["remove.txt"],
      unchanged: ["same.txt"],
    });
  });
});
