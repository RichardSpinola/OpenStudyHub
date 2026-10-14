"use client";
import { useRef, useId, type ReactNode } from "react";
import { IconDots } from "@tabler/icons-react";
import { useUiText } from "./ui-language-provider";
export function DocumentOptionsDialog({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId(),
    tr = useUiText();
  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="document-options-trigger"
        aria-label={tr(`Opções de ${name}`, `Options for ${name}`)}
        onClick={() => dialog.current?.showModal()}
      >
        <IconDots size={20} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="document-options-dialog"
        aria-labelledby={id}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <header>
          <div>
            <small>{tr("DOCUMENTO", "DOCUMENT")}</small>
            <h2 id={id}>{name}</h2>
          </div>
          <button
            type="button"
            aria-label={tr("Fechar opções", "Close options")}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div className="document-options-content">{children}</div>
      </dialog>
    </>
  );
}
