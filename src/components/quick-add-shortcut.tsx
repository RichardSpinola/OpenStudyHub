"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  createShortcutFromHomeAction,
  type QuickAddState,
} from "@/app/settings/actions";
import { useUiTranslations } from "@/components/ui-language-provider";

const initialState: QuickAddState = { status: "idle" };

function SubmitButton({
  idle,
  pendingLabel,
}: {
  idle: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? pendingLabel : idle}
    </button>
  );
}

export function QuickAddShortcut() {
  const { shortcuts } = useUiTranslations();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    createShortcutFromHomeAction,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button
        className="quick-add-slot"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        <span className="shortcut-visual" aria-hidden="true">
          <span>+</span>
        </span>
        <span className="shortcut-name">{shortcuts.add}</span>
      </button>

      <dialog className="quick-add-dialog" ref={dialogRef}>
        <div className="dialog-titlebar">
          <strong>{shortcuts.newShortcut}</strong>
          <button
            type="button"
            aria-label={shortcuts.close}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <form ref={formRef} action={formAction} className="quick-add-form">
          <label>
            {shortcuts.name}
            <input name="name" type="text" maxLength={80} required />
          </label>
          <label>
            {shortcuts.url}
            <input
              name="url"
              type="url"
              maxLength={2048}
              placeholder="https://"
              required
            />
          </label>
          <label>
            {shortcuts.abbreviation}
            <input name="icon" type="text" maxLength={8} placeholder="WEB" />
          </label>
          {state.status === "error" ? (
            <p className="form-error" role="alert">
              {shortcuts.addError}
            </p>
          ) : null}
          <div className="dialog-actions">
            <button type="button" onClick={() => dialogRef.current?.close()}>
              {shortcuts.cancel}
            </button>
            <SubmitButton
              idle={shortcuts.save}
              pendingLabel={shortcuts.saving}
            />
          </div>
        </form>
      </dialog>
    </>
  );
}
