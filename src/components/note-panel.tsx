"use client";
import { useId, useRef, type ReactNode, type RefObject } from "react";
import { useUiText } from "@/components/ui-language-provider";
export function NotePanel({
  label,
  children,
  dialogRef,
  triggerLabel,
  busy = false,
}: {
  label: string;
  children: ReactNode;
  dialogRef?: RefObject<HTMLDialogElement | null>;
  triggerLabel?: string;
  busy?: boolean;
}) {
  const internalDialog = useRef<HTMLDialogElement>(null);
  const dialog = dialogRef ?? internalDialog,
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
        {triggerLabel ?? label}
      </button>
      <dialog
        ref={dialog}
        className="note-panel-dialog"
        aria-labelledby={id}
        onClose={() => trigger.current?.focus()}
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
        onClick={(e) => {
          if (!busy && e.target === dialog.current) dialog.current?.close();
        }}
      >
        <header>
          <h2 id={id}>{label}</h2>
          <button
            type="button"
            disabled={busy}
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
