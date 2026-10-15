"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useUiText } from "@/components/ui-language-provider";

export function AdminActionPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const tr = useUiText();
  const search = useSearchParams();
  const feedback = useRef<HTMLParagraphElement>(null);
  const titles: Record<string, string> = {
    "Criar usuário": "Create user",
    "Editar conta": "Edit account",
    "Redefinir senha": "Reset password",
    "Excluir conta": "Delete account",
    "Adicionar instituição": "Add institution",
    "Adicionar curso": "Add course",
    "Adicionar turma": "Add cohort",
    "Adicionar currículo": "Add curriculum",
    "Adicionar semestre curricular": "Add curriculum semester",
    "Associar disciplina ao semestre": "Assign subject to semester",
    "Preparar período para turma": "Prepare period for cohort",
    "Criar turma da disciplina": "Create subject offering",
    "Vincular oferta à turma": "Link offering to cohort",
    "Ligar à turma V1": "Link to V1 cohort",
    "Matricular estudante": "Enroll student",
  };
  const label = tr(title, titles[title] ?? title);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  // Keep nonsecret academic drafts in this tab so a rejected submission can be corrected.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const key = `osh.academic-draft:${location.pathname}:${title}`;
    try {
      if (
        search.has("error") &&
        sessionStorage.getItem("osh.academic-last-draft") === key
      ) {
        if (feedback.current)
          feedback.current.textContent = search.get("error");
        const saved = sessionStorage.getItem(key);
        if (saved) {
          const values = JSON.parse(saved) as Record<string, string>;
          for (const input of element.querySelectorAll<
            HTMLInputElement | HTMLSelectElement
          >("input,select,textarea"))
            if (
              input.name in values &&
              !["hidden", "password", "file"].includes(input.type)
            )
              input.value = values[input.name];
          if (!element.open) element.showModal();
        }
      } else if (search.has("ok")) {
        sessionStorage.removeItem(key);
        if (sessionStorage.getItem("osh.academic-last-draft") === key) {
          sessionStorage.removeItem("osh.academic-last-draft");
          if (feedback.current) feedback.current.textContent = "";
          // A successful action can update the same route without remounting
          // its dialog. Close it so the page's success message is visible.
          if (element.open) element.close();
        }
      }
    } catch {
      /* Storage is optional; registration still works when disabled. */
    }
    const save = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const values: Record<string, string> = {};
      for (const input of form.querySelectorAll<
        HTMLInputElement | HTMLSelectElement
      >("input,select,textarea"))
        if (input.name && !["hidden", "password", "file"].includes(input.type))
          values[input.name] = input.value;
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
        sessionStorage.setItem("osh.academic-last-draft", key);
      } catch {}
    };
    element.addEventListener("submit", save);
    return () => element.removeEventListener("submit", save);
  }, [title, search]);
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="admin-action-dialog"
        aria-label={label}
        onClose={(event) => {
          if (event.target !== event.currentTarget) return;
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <header>
          <h2>{label}</h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={tr("Fechar painel", "Close panel")}
          >
            ×
          </button>
        </header>
        <div className="admin-action-dialog-body">
          <p ref={feedback} role="alert" />
          {children}
        </div>
      </dialog>
    </>
  );
}
