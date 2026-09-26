"use client";

import { useEffect } from "react";

let currentSocket: WebSocket | null = null;
export function sendRealtime(event: unknown): boolean {
  if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) return false;
  currentSocket.send(JSON.stringify(event));
  return true;
}
export function closeRealtime() {
  currentSocket?.close(1000, "logout");
  currentSocket = null;
}
function emit(detail: unknown) {
  window.dispatchEvent(new CustomEvent("openstudyhub:realtime", { detail }));
}

export function RealtimeBridge() {
  useEffect(() => {
    let disposed = false;
    let retry: number | undefined;
    let heartbeat: number | undefined;
    let attempt = 0;
    let socket: WebSocket | null = null;
    const connect = async () => {
      if (disposed || !navigator.onLine) return;
      try {
        const response = await fetch("/api/realtime/config", { cache: "no-store" });
        if (!response.ok) return;
        const config = await response.json() as { enabled: boolean; url?: string };
        if (!config.enabled || !config.url || disposed) return;
        socket = new WebSocket(config.url);
        currentSocket = socket;
        socket.onopen = () => {
          attempt = 0;
          emit({ type: "ready" });
          heartbeat = window.setInterval(() => sendRealtime({ type: "heartbeat" }), 15000);
        };
        socket.onmessage = (event) => {
          try { emit(JSON.parse(event.data)); } catch { /* Ignore malformed event. */ }
        };
        socket.onclose = () => {
          if (currentSocket === socket) currentSocket = null;
          window.clearInterval(heartbeat);
          emit({ type: "disconnected" });
          if (!disposed) {
            const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5));
            retry = window.setTimeout(connect, delay + Math.round(Math.random() * 300));
          }
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (!disposed) retry = window.setTimeout(connect, 5000);
      }
    };
    const online = () => { if (!currentSocket) { window.clearTimeout(retry); void connect(); } };
    window.addEventListener("online", online);
    void connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      window.clearInterval(heartbeat);
      window.removeEventListener("online", online);
      socket?.close(1000, "unmount");
      if (currentSocket === socket) currentSocket = null;
    };
  }, []);
  return null;
}
