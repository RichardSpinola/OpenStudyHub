"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUiText } from "./ui-language-provider";
export function SettingsForm({
  action,
  autoSave = false,
  children,
  className,
}: {
  action: (form: FormData) => Promise<void>;
  autoSave?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const tr = useUiText(),
    router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false),
    again = useRef<HTMLFormElement | null>(null);
  async function save(form: HTMLFormElement) {
    if (!form.reportValidity()) return;
    if (busy.current) {
      again.current = form;
      return;
    }
    busy.current = true;
    setFailed(false);
    const data = new FormData(form);
    start(async () => {
      try {
        await action(data);
        setStatus(tr("Alterações salvas.", "Changes saved."));
        router.refresh();
      } catch {
        setFailed(true);
        setStatus(
          tr(
            "Não foi possível salvar. Revise e tente novamente.",
            "Could not save. Review and try again.",
          ),
        );
      } finally {
        busy.current = false;
        const next = again.current;
        again.current = null;
        if (next) void save(next);
      }
    });
  }
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        void save(e.currentTarget);
      }}
      onChange={
        autoSave
          ? (e) => {
              void save(e.currentTarget);
            }
          : undefined
      }
      aria-busy={pending}
    >
      {children}
      <p className="settings-save-status" role="status">
        {pending
          ? tr("Salvando…", "Saving…")
          : status ||
            (autoSave
              ? tr(
                  "As alterações são salvas automaticamente.",
                  "Changes are saved automatically.",
                )
              : "")}
      </p>
      {autoSave && failed ? (
        <button type="submit" disabled={pending}>
          {tr("Tentar salvar novamente", "Try saving again")}
        </button>
      ) : null}
    </form>
  );
}
