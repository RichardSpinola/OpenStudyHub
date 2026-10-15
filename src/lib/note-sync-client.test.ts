import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { NoteSync } from "./note-sync-client";
vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    whenSynced = Promise.resolve();
    set = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn().mockResolvedValue(undefined);
  },
  storeState: vi.fn().mockResolvedValue(undefined),
}));
function initial() {
  const doc = new Y.Doc();
  doc.getText("title").insert(0, "Página");
  const value = {
    state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    vector: Buffer.from(Y.encodeStateVector(doc)).toString("base64"),
    revision: 0,
    editable: true,
    owner: true,
  };
  return { doc, value };
}
function packet(doc: Y.Doc, revision = 1) {
  return {
    state: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
    vector: Buffer.from(Y.encodeStateVector(doc)).toString("base64"),
    revision,
    editable: true,
    owner: true,
  };
}
describe("note save confirmation", () => {
  let sync: NoteSync | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (k: string, v: string) => storage.set(k, v),
      getItem: (k: string) => storage.get(k) ?? null,
      removeItem: (k: string) => storage.delete(k),
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });
  afterEach(async () => {
    sync?.stop();
    await vi.advanceTimersByTimeAsync(1);
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("does not report saved on network failure and clears dirty only after server confirmation", async () => {
    const { doc, value } = initial();
    sync = new NoteSync(1, 1, value);
    await sync.start();
    sync.doc.getText("title").insert(0, "Rascunho ");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await sync.flush()).toBe(false);
    expect(sync.dirty()).toBe(true);
    expect(sync.snapshot().phase).toBe("offline");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, options: RequestInit) => {
        const update = JSON.parse(String(options.body)).update;
        Y.applyUpdate(doc, Buffer.from(update, "base64"));
        return Response.json(packet(doc));
      }),
    );
    expect(await sync.flush()).toBe(true);
    expect(sync.dirty()).toBe(false);
    expect(sync.snapshot().phase).toBe("saved");
    expect(doc.getText("title").toString()).toBe("Rascunho Página");
    doc.destroy();
  });
  it("keeps newer typing pending while an older save is awaiting acknowledgement", async () => {
    const { doc, value } = initial();
    sync = new NoteSync(1, 1, value);
    await sync.start();
    sync.doc.getText("title").insert(0, "A ");
    let complete!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: unknown, options: RequestInit) => {
        Y.applyUpdate(
          doc,
          Buffer.from(JSON.parse(String(options.body)).update, "base64"),
        );
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      }),
    );
    const pending = sync.flush();
    sync.doc.getText("title").insert(0, "B ");
    complete(Response.json(packet(doc)));
    await pending;
    expect(sync.dirty()).toBe(true);
    expect(sync.snapshot().phase).toBe("pending");
    expect(doc.getText("title").toString()).toBe("A Página");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, options: RequestInit) => {
        Y.applyUpdate(
          doc,
          Buffer.from(JSON.parse(String(options.body)).update, "base64"),
        );
        return Response.json(packet(doc, 2));
      }),
    );
    await sync.flush();
    expect(doc.getText("title").toString()).toBe("B A Página");
    expect(sync.dirty()).toBe(false);
    doc.destroy();
  });
});
