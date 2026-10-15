"use client";
import { useId, useRef, type ReactNode } from "react";
import { useUiText } from "@/components/ui-language-provider";
export function NotePanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId(),
    tr = useUiText();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="note-panel-dialog"
        aria-labelledby={id}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <header>
          <h2 id={id}>{label}</h2>
          <button
            type="button"
            aria-label={tr("Fechar", "Close")}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <div>{children}</div>
      </dialog>
    </>
  );
}
