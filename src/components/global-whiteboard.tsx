"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useUiLanguage, useUiText } from "@/components/ui-language-provider";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  changedBoardElements,
  mergeBoardScene,
  type BoardElement,
} from "@/lib/v2/whiteboard";

if (typeof window !== "undefined") {
  (
    window as Window & { EXCALIDRAW_ASSET_PATH?: string }
  ).EXCALIDRAW_ASSET_PATH = "/excalidraw/";
}

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((module) => module.Excalidraw),
  { ssr: false },
);
type Participant = { id: string; name: string; legacyId: number };

export function GlobalWhiteboard() {
  const language = useUiLanguage();
  const tr = useUiText();
  const [scene, setScene] = useState<BoardElement[] | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState(() =>
    tr("Carregando quadro…", "Loading whiteboard…"),
  );
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef<number | null>(null);
  const pendingRemote = useRef<BoardElement[] | null>(null);
  const pendingChanges = useRef<BoardElement[]>([]);
  const unsent = useRef<BoardElement[] | null>(null);
  const knownVersions = useRef(new Map<string, string>());
  const ready = scene !== null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/extras/whiteboard", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Whiteboard unavailable.");
        return response.json() as Promise<{ elements: BoardElement[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          for (const element of data.elements)
            knownVersions.current.set(
              element.id,
              `${element.version}:${element.versionNonce ?? 0}`,
            );
          setScene(data.elements);
        }
      })
      .catch(() => {
        if (!cancelled)
          setStatus(
            tr(
              "Não foi possível carregar o quadro.",
              "Could not load whiteboard.",
            ),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [tr]);

  useEffect(() => {
    if (!ready) return;
    let closed = false;
    let retry: number | undefined;
    async function connect() {
      try {
        const response = await fetch("/api/realtime/config", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Realtime unavailable.");
        const config = (await response.json()) as {
          enabled: boolean;
          url: string;
        };
        if (!config.enabled || closed) return;
        const url = new URL(config.url);
        url.pathname = "/whiteboard";
        const ws = new WebSocket(url);
        socket.current = ws;
        ws.onopen = () => {
          setStatus(
            tr(
              "Conectado · alterações salvas automaticamente",
              "Connected · changes saved automatically",
            ),
          );
          if (unsent.current) {
            ws.send(
              JSON.stringify({ type: "patch", elements: unsent.current }),
            );
            unsent.current = null;
          }
        };
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data as string) as {
            type: string;
            elements?: BoardElement[];
            participants?: Participant[];
          };
          if (message.type === "presence" && message.participants)
            setParticipants(message.participants);
          if (message.type === "saved")
            setStatus(
              tr("Conectado · alterações salvas", "Connected · changes saved"),
            );
          if (
            (message.type === "scene" || message.type === "patch") &&
            message.elements
          ) {
            for (const element of message.elements)
              knownVersions.current.set(
                element.id,
                `${element.version}:${element.versionNonce ?? 0}`,
              );
            const current =
              api.current?.getSceneElementsIncludingDeleted() as unknown as
                BoardElement[] | undefined;
            const merged = mergeBoardScene(current ?? [], message.elements);
            if (api.current) {
              api.current.updateScene({
                elements: merged as unknown as ExcalidrawElement[],
                captureUpdate: "NEVER",
              });
            } else
              pendingRemote.current = mergeBoardScene(
                pendingRemote.current ?? [],
                merged,
              );
          }
        };
        ws.onclose = () => {
          if (closed) return;
          setStatus(tr("Reconectando…", "Reconnecting…"));
          setParticipants([]);
          retry = window.setTimeout(() => void connect(), 3000);
        };
        ws.onerror = () => ws.close();
      } catch {
        if (!closed) {
          setStatus(tr("Reconectando…", "Reconnecting…"));
          retry = window.setTimeout(() => void connect(), 3000);
        }
      }
    }
    void connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      if (pending.current) window.clearTimeout(pending.current);
      socket.current?.close();
    };
  }, [ready, tr]);

  if (!scene) return <p role="status">{status}</p>;
  return (
    <section
      className="global-whiteboard"
      aria-label={tr("Quadro Global", "Global Whiteboard")}
    >
      <div className="whiteboard-status">
        <span role="status">{status}</span>
        <div
          aria-label={tr("Participantes no quadro", "Whiteboard participants")}
        >
          {participants.map((person) => (
            <span
              key={person.id}
              title={person.name}
              className="whiteboard-person"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/profile-media/${person.legacyId}/avatar`}
                alt=""
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              {person.name}
            </span>
          ))}
        </div>
      </div>
      <div className="whiteboard-canvas">
        <Excalidraw
          initialData={{ elements: scene as unknown as ExcalidrawElement[] }}
          excalidrawAPI={(value) => {
            api.current = value;
            if (pendingRemote.current) {
              value.updateScene({
                elements:
                  pendingRemote.current as unknown as ExcalidrawElement[],
                captureUpdate: "NEVER",
              });
              pendingRemote.current = null;
            }
          }}
          onChange={(elements) => {
            const snapshot = elements as unknown as BoardElement[];
            if (snapshot.some((element) => element.type === "image")) {
              api.current?.updateScene({
                elements: snapshot.filter(
                  (element) => element.type !== "image",
                ) as unknown as ExcalidrawElement[],
                captureUpdate: "NEVER",
              });
              setStatus(
                tr(
                  "Imagens ainda não são suportadas neste quadro.",
                  "Images are not yet supported on this whiteboard.",
                ),
              );
              return;
            }
            const changed = changedBoardElements(
              snapshot,
              knownVersions.current,
            );
            if (!changed.length) return;
            for (const element of changed)
              knownVersions.current.set(
                element.id,
                `${element.version}:${element.versionNonce ?? 0}`,
              );
            pendingChanges.current = mergeBoardScene(
              pendingChanges.current,
              changed,
            );
            if (pending.current) window.clearTimeout(pending.current);
            setStatus(tr("Salvando alterações…", "Saving changes…"));
            pending.current = window.setTimeout(() => {
              const patch = pendingChanges.current;
              pendingChanges.current = [];
              if (socket.current?.readyState === WebSocket.OPEN) {
                socket.current.send(
                  JSON.stringify({ type: "patch", elements: patch }),
                );
                unsent.current = null;
              } else
                unsent.current = mergeBoardScene(unsent.current ?? [], patch);
            }, 180);
          }}
          UIOptions={{ tools: { image: false } }}
          onPaste={async (data) =>
            !data.elements?.some((element) => element.type === "image")
          }
          langCode={language === "en" ? "en" : "pt-BR"}
          theme="dark"
        />
      </div>
    </section>
  );
}
