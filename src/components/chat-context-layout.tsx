"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const ChatContext = createContext({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function useChatContext() {
  return useContext(ChatContext);
}

export function ChatContextLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest(".chat-context-panel, .chat-context-toggle")
      ) {
        setOpen(false);
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <ChatContext.Provider
      value={{
        open,
        toggle: () => setOpen((value) => !value),
        close: () => setOpen(false),
      }}
    >
      <div className="chat-layout" data-context-open={open}>
        {children}
      </div>
    </ChatContext.Provider>
  );
}

export function ChatContextToggle({ children }: { children: ReactNode }) {
  const context = useContext(ChatContext);
  return (
    <button
      type="button"
      className="chat-context-toggle chat-header-identity"
      aria-label={
        context.open
          ? "Ocultar detalhes da conversa"
          : "Mostrar detalhes da conversa"
      }
      aria-expanded={context.open}
      onClick={context.toggle}
    >
      {children}
    </button>
  );
}

export function ChatContextClose() {
  const context = useContext(ChatContext);
  return (
    <button type="button" onClick={context.close} aria-label="Fechar detalhes">
      ×
    </button>
  );
}
