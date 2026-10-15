"use client";
import * as Y from "yjs";
import { IndexeddbPersistence, storeState } from "y-indexeddb";
import type { NoteWorkspaceState } from "@/lib/note-workspace";

export const noteBytes = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export function noteBase64(value: Uint8Array) {
  let text = "";
  for (let i = 0; i < value.length; i += 8192)
    text += String.fromCharCode(...value.subarray(i, i + 8192));
  return btoa(text);
}
export type NoteSyncStatus = {
  phase:
    "loading" | "saved" | "pending" | "saving" | "offline" | "error" | "denied";
  error: string;
  editable: boolean;
  local: boolean;
  recovered: boolean;
};

// A small HTTP Yjs provider: one request at a time, debounced writes, no permanent
// socket per page. The server ACK is the only source of the "saved" indicator.
export class NoteSync {
  readonly doc = new Y.Doc();
  private listeners = new Set<() => void>();
  private value: NoteSyncStatus;
  private generation = 0;
  private acknowledged = 0;
  private vector: Uint8Array;
  private revision: number;
  private timer?: ReturnType<typeof setTimeout>;
  private poll?: ReturnType<typeof setInterval>;
  private persistence?: IndexeddbPersistence;
  private stopped = false;
  private request?: Promise<boolean>;
  private abort = new AbortController();
  private key: string;
  private ready = false;
  private disposal?: ReturnType<typeof setTimeout>;
  private starting = false;
  private localTimer?: ReturnType<typeof setTimeout>;
  constructor(
    readonly noteId: number,
    userId: number,
    initial: NoteWorkspaceState,
  ) {
    Y.applyUpdate(this.doc, noteBytes(initial.state), "remote");
    this.vector = noteBytes(initial.vector);
    this.revision = initial.revision;
    this.key = `osh:note:${userId}:${noteId}:pending`;
    this.value = {
      phase: "loading",
      error: "",
      editable: initial.editable,
      local: false,
      recovered: false,
    };
  }
  snapshot = () => this.value;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(value: Partial<NoteSyncStatus>) {
    this.value = { ...this.value, ...value };
    this.listeners.forEach((fn) => fn());
  }
  private change = (_update: Uint8Array, origin: unknown) => {
    if (
      origin === "remote" ||
      origin === this.persistence ||
      !this.value.editable
    )
      return;
    this.generation++;
    try {
      localStorage.setItem(this.key, "1");
    } catch {
      this.set({ local: false });
    }
    clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => {
      if (this.persistence)
        void this.persistence
          .set("checkpoint", Date.now())
          .catch(() => this.set({ local: false }));
    }, 250);
    this.set({ phase: "pending", error: "" });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 800);
  };
  async start() {
    clearTimeout(this.disposal);
    if (this.starting) return;
    this.starting = true;
    this.doc.on("update", this.change);
    try {
      this.persistence = new IndexeddbPersistence(
        this.key.replace(":pending", ":draft"),
        this.doc,
      );
      await this.persistence.whenSynced;
      if (this.stopped) return;
      this.set({ local: true });
      if (localStorage.getItem(this.key) && this.value.editable) {
        this.generation++;
        this.set({ recovered: true, phase: "pending" });
      }
    } catch {
      this.set({ local: false });
    }
    this.ready = true;
    if (this.stopped) return;
    if (this.dirty()) void this.flush();
    else this.set({ phase: "saved" });
    this.poll = setInterval(() => {
      if (document.visibilityState === "visible") void this.sync();
    }, 5000);
    window.addEventListener("online", this.online);
    document.addEventListener("visibilitychange", this.visible);
  }
  private online = () => void this.sync();
  private visible = () => {
    if (document.visibilityState === "visible") void this.sync();
  };
  dirty = () => this.generation > this.acknowledged;
  async flush(): Promise<boolean> {
    if (!this.ready || this.stopped) return false;
    if (this.request) {
      await this.request;
      return this.dirty() ? this.flush() : this.value.phase !== "denied";
    }
    if (!this.dirty()) return this.value.phase !== "denied";
    if (!this.value.editable) return false;
    this.request = this.exchange(true);
    try {
      return await this.request;
    } finally {
      this.request = undefined;
    }
  }
  async sync() {
    if (this.stopped || this.request || !this.ready) return;
    if (this.dirty()) {
      await this.flush();
      return;
    }
    this.request = this.exchange(false);
    try {
      await this.request;
    } finally {
      this.request = undefined;
    }
  }
  private async exchange(write: boolean): Promise<boolean> {
    const sentGeneration = this.generation;
    if (write) this.set({ phase: "saving" });
    try {
      const response = await fetch(`/api/notes/${this.noteId}/workspace`, {
        method: write ? "POST" : "GET",
        cache: "no-store",
        signal: this.abort.signal,
        headers: write
          ? { "content-type": "application/json" }
          : {
              "if-none-match": `"${this.revision}-${Number(this.value.editable)}"`,
            },
        body: write
          ? JSON.stringify({
              update: noteBase64(Y.encodeStateAsUpdate(this.doc, this.vector)),
            })
          : undefined,
      });
      if (response.status === 304) return true;
      const packet = (await response.json()) as NoteWorkspaceState & {
        error?: string;
      };
      if (!response.ok) {
        const denied =
          response.status === 401 ||
          response.status === 404 ||
          (response.status === 403 &&
            /leitura|prova|indisponível|SESSION|Entre novamente/.test(
              packet.error ?? "",
            ));
        this.set({
          phase: denied ? "denied" : "error",
          editable: denied ? false : this.value.editable,
          error: packet.error || "Não foi possível sincronizar.",
        });
        return false;
      }
      Y.applyUpdate(this.doc, noteBytes(packet.state), "remote");
      this.vector = noteBytes(packet.vector);
      this.revision = packet.revision;
      if (write) this.acknowledged = sentGeneration;
      if (!this.dirty()) {
        try {
          localStorage.removeItem(this.key);
        } catch {
          /* ACK still valid. */
        }
      }
      this.set({
        phase: this.dirty() ? "pending" : "saved",
        editable: packet.editable,
        error: "",
      });
      return true;
    } catch {
      if (this.stopped) return false;
      this.set({ phase: "offline", error: "" });
      return false;
    }
  }
  stop() {
    this.disposal = setTimeout(() => void this.dispose(), 0);
  }
  private async dispose() {
    this.stopped = true;
    this.abort.abort();
    clearTimeout(this.timer);
    clearInterval(this.poll);
    clearTimeout(this.localTimer);
    window.removeEventListener("online", this.online);
    document.removeEventListener("visibilitychange", this.visible);
    this.doc.off("update", this.change);
    if (this.persistence) {
      try {
        await storeState(this.persistence, true);
        await this.persistence.destroy();
      } catch {
        /* Existing server copy is retained. */
      }
    }
    this.doc.destroy();
  }
}
