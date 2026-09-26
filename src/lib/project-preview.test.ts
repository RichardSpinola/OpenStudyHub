import { describe, expect, it } from "vitest";

import {
  buildProjectFileTree,
  canPreviewProjectPath,
  decodeProjectText,
} from "./project-preview";

describe("project file preview", () => {
  it("monta pastas a partir dos caminhos existentes", () => {
    const files = [
      "src/components/Header.tsx",
      "src/app.tsx",
      "public/logo.png",
      "README.md",
    ].map((path) => ({
      path,
      sizeBytes: 3,
      mimeType: null,
      driveFileId: path,
    }));
    const tree = buildProjectFileTree(files);
    expect(tree.map((node) => node.name)).toEqual([
      "public",
      "src",
      "README.md",
    ]);
    expect(tree[1].children.map((node) => node.name)).toEqual([
      "components",
      "app.tsx",
    ]);
    expect(tree[1].children[0].children[0].path).toBe(
      "src/components/Header.tsx",
    );
  });
  it("aceita texto UTF-8 comum e recusa binários e extensões executáveis", () => {
    expect(canPreviewProjectPath("src/main.tsx")).toBe(true);
    expect(canPreviewProjectPath("public/logo.png")).toBe(false);
    expect(canPreviewProjectPath("run.exe")).toBe(false);
    expect(decodeProjectText(Buffer.from("Olá, mundo\n"))).toBe("Olá, mundo\n");
    expect(decodeProjectText(Buffer.from([0, 1, 2]))).toBeNull();
    expect(decodeProjectText(Buffer.from([65, 1, 66]))).toBeNull();
    expect(decodeProjectText(Buffer.from([0xff, 0xfe]))).toBeNull();
  });
});
