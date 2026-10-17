import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withProjectTransfer, spoolProjectBody } from "./project-transfer";
import { createProjectZipFile, readProjectZip } from "./project-archive";

it("serializes heavy project transfers without an unbounded queue and releases failed work", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const first = withProjectTransfer(async () => {
    await gate;
    throw new Error("failure");
  });
  await expect(withProjectTransfer(async () => "second")).rejects.toThrow(
    "andamento",
  );
  release();
  await expect(first).rejects.toThrow("failure");
  await expect(withProjectTransfer(async () => "retry")).resolves.toBe("retry");
});
it("spools bounded bodies, removes incomplete uploads and never overwrites an existing file", async () => {
  const root = await mkdtemp(join(tmpdir(), "osh-project-stream-"));
  const path = join(root, "body.zip");
  try {
    await spoolProjectBody(
      new Request("http://localhost", { method: "POST", body: "1234" }),
      path,
      4,
    );
    expect(await readFile(path, "utf8")).toBe("1234");
    await expect(
      spoolProjectBody(
        new Request("http://localhost", { method: "POST", body: "other" }),
        path,
        10,
      ),
    ).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("1234");
    await rm(path);
    await expect(
      spoolProjectBody(
        new Request("http://localhost", { method: "POST", body: "12345" }),
        path,
        4,
      ),
    ).rejects.toThrow("size limit");
    await expect(readFile(path)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("creates a ZIP on disk and reads only the requested source, preserving an existing destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "osh-project-zip-file-"));
  const path = join(root, "archive.zip");
  try {
    const files = [
      { path: "a.txt", data: Buffer.from("A") },
      { path: "b.txt", data: Buffer.from("B") },
    ];
    await createProjectZipFile(files, path);
    expect(await readProjectZip(path, "b.txt")).toEqual([files[1]]);
    await writeFile(join(root, "existing.zip"), "keep");
    await expect(
      createProjectZipFile(files, join(root, "existing.zip")),
    ).rejects.toThrow();
    expect(await readFile(join(root, "existing.zip"), "utf8")).toBe("keep");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
