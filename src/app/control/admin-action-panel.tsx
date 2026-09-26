"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUiText } from "@/components/ui-language-provider";

export function AdminActionPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const tr = useUiText();
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
  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="admin-action-dialog"
        aria-label={label}
        onClose={() => {
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
        <div className="admin-action-dialog-body">{children}</div>
      </dialog>
    </>
  );
}
