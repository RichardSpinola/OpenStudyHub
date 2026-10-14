"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Shortcut } from "@/lib/shortcuts";
import {
  updatePersonalShortcutAction,
  togglePersonalShortcutAction,
  deletePersonalShortcutAction,
} from "@/app/settings/actions";
import { UiCopy, useUiText } from "./ui-language-provider";
import { ConfirmSubmitButton } from "./confirm-submit-button";

export function ShortcutEditDialog({
  shortcut,
  close,
}: {
  shortcut: Shortcut;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const tr = useUiText();
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);
  function execute(action: (form: FormData) => Promise<void>, form: FormData) {
    setError("");
    startTransition(async () => {
      try {
        await action(form);
        close();
      } catch {
        setError(
          tr(
            "Não foi possível salvar. Confira os campos e tente novamente.",
            "Could not save. Check the fields and try again.",
          ),
        );
      }
    });
  }
  return (
    <dialog
      ref={dialog}
      className="home-shortcut-dialog"
      onClose={() => {
        if (!dialog.current?.open) close();
      }}
      aria-labelledby="shortcut-edit-title"
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <header>
        <h2 id="shortcut-edit-title">
          <UiCopy pt="Editar atalho" en="Edit shortcut" />
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label={tr("Fechar", "Close")}
        >
          ×
        </button>
      </header>
      <form action={(form) => execute(updatePersonalShortcutAction, form)}>
        <input type="hidden" name="id" value={shortcut.id} />
        <label>
          <UiCopy pt="Nome" en="Name" />
          <input
            name="name"
            defaultValue={shortcut.name}
            required
            maxLength={80}
          />
        </label>
        <label>
          URL
          <input
            name="url"
            type="url"
            defaultValue={shortcut.url}
            required
            maxLength={2048}
          />
        </label>
        <label>
          <UiCopy
            pt="Sigla (quando não houver ícone)"
            en="Abbreviation (when no icon is available)"
          />
          <input name="icon" defaultValue={shortcut.icon ?? ""} maxLength={8} />
        </label>
        <button type="submit" disabled={pending}>
          <UiCopy pt="Salvar atalho" en="Save shortcut" />
        </button>
      </form>
      <div className="home-shortcut-secondary-actions">
        <form action={(form) => execute(togglePersonalShortcutAction, form)}>
          <input type="hidden" name="id" value={shortcut.id} />
          <input type="hidden" name="enabled" value="false" />
          <button disabled={pending}>
            <UiCopy pt="Ocultar da Home" en="Hide from Home" />
          </button>
        </form>
        <form action={(form) => execute(deletePersonalShortcutAction, form)}>
          <input type="hidden" name="id" value={shortcut.id} />
          <ConfirmSubmitButton
            confirmation={tr(
              `Remover o atalho ${shortcut.name}? Isso não remove o site nem seus arquivos.`,
              `Remove the ${shortcut.name} shortcut? This does not delete the site or your files.`,
            )}
            disabled={pending}
          >
            <UiCopy pt="Remover atalho" en="Remove shortcut" />
          </ConfirmSubmitButton>
        </form>
      </div>
      {error ? (
        <p role="alert" className="form-error">
          {error}
        </p>
      ) : null}
    </dialog>
  );
}
