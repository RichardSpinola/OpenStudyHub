"use client";
import { useState, useRef, useEffect } from "react";
import { IconCalendarDown, IconDownload } from "@tabler/icons-react";
import { PlanningDialog } from "./planning-dialog";
import { useUiText } from "./ui-language-provider";
export function CalendarExport({
  from,
  until,
  timeZone,
}: {
  from: string;
  until: string;
  timeZone: string;
}) {
  const tr = useUiText(),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  return (
    <>
      <button
        type="button"
        className="calendar-export-button"
        data-tour="calendar-export"
        onClick={() => {
          setStatus("");
          setError("");
          setOpen(true);
        }}
      >
        <IconCalendarDown size={18} />
        {tr("Exportar agenda", "Export calendar")}
      </button>
      {open ? (
        <PlanningDialog
          title={tr("Exportar agenda", "Export calendar")}
          onClose={() => {
            abort.current?.abort();
            setBusy(false);
            setOpen(false);
          }}
        >
          <p>
            {tr(
              "Leve seus horários para outro calendário. O arquivo não se atualiza sozinho: exporte novamente quando houver mudanças.",
              "Take your schedule to another calendar. The file does not update automatically: export again when things change.",
            )}
          </p>
          <form
            className="planning-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const data = new FormData(e.currentTarget),
                kinds = data.getAll("include").map(String);
              setError("");
              setStatus("");
              if (!kinds.length) {
                setError(
                  tr(
                    "Escolha pelo menos um conteúdo.",
                    "Select at least one category.",
                  ),
                );
                return;
              }
              setBusy(true);
              const controller = new AbortController();
              abort.current = controller;
              try {
                const q = new URLSearchParams({
                  from: String(data.get("from")),
                  until: String(data.get("until")),
                  include: kinds.join(","),
                });
                const response = await fetch(`/api/calendar/export?${q}`, {
                  signal: controller.signal,
                });
                if (!response.ok) {
                  const r = await response.json();
                  setError(
                    r.error ??
                      tr("Não foi possível exportar.", "Could not export."),
                  );
                  return;
                }
                const blob = await response.blob(),
                  url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "openstudyhub-agenda.ics";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                const count = response.headers.get("x-calendar-count") ?? "0";
                setStatus(
                  count === "0"
                    ? tr(
                        "Arquivo baixado sem compromissos. Confira os conteúdos e o período escolhidos.",
                        "File downloaded with no entries. Check the categories and dates.",
                      )
                    : tr(
                        `${count} compromisso(s) exportado(s). Importe o arquivo no seu calendário.`,
                        `${count} entries exported. Import the file into your calendar.`,
                      ),
                );
              } catch {
                if (!controller.signal.aborted)
                  setError(
                    tr(
                      "Não foi possível baixar. Tente novamente.",
                      "Could not download. Try again.",
                    ),
                  );
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="planning-form-columns">
              <label>
                {tr("De", "From")}
                <input
                  type="date"
                  name="from"
                  required
                  defaultValue={from}
                  disabled={busy}
                />
              </label>
              <label>
                {tr("Até", "Until")}
                <input
                  type="date"
                  name="until"
                  required
                  defaultValue={until}
                  disabled={busy}
                />
              </label>
            </div>
            <small>
              {tr("Horários preservados no fuso", "Times preserved in")}{" "}
              {timeZone} ·{" "}
              {tr("até um ano por arquivo", "up to one year per file")}
            </small>
            <fieldset>
              <legend>{tr("O que incluir", "Include")}</legend>
              {(
                [
                  ["classes", "Aulas", "Classes"],
                  ["events", "Eventos acadêmicos", "Academic events"],
                  ["deadlines", "Prazos do Classroom", "Classroom deadlines"],
                  [
                    "tasks",
                    "Minhas tarefas com prazo",
                    "My tasks with deadlines",
                  ],
                ] as const
              ).map(([value, pt, en]) => (
                <label className="planning-check" key={value}>
                  <input
                    type="checkbox"
                    name="include"
                    value={value}
                    defaultChecked
                    disabled={busy}
                  />
                  {tr(pt, en)}
                </label>
              ))}
            </fieldset>
            <p className="panel-help">
              {tr(
                "Somente seus conteúdos acessíveis serão incluídos. Tarefas concluídas e entregas finalizadas ficam de fora. A importação depende do aplicativo de calendário usado.",
                "Only content you can access is included. Completed tasks and submissions are excluded. Import support depends on your calendar application.",
              )}
            </p>
            {error ? <p role="alert">{error}</p> : null}
            <p role="status">
              {busy ? tr("Preparando arquivo…", "Preparing file…") : status}
            </p>
            <div className="planning-actions">
              <button
                type="button"
                onClick={() => {
                  abort.current?.abort();
                  setOpen(false);
                  setBusy(false);
                }}
              >
                {tr("Fechar", "Close")}
              </button>
              <button type="submit" disabled={busy}>
                <IconDownload size={18} />
                {tr("Baixar agenda", "Download calendar")}
              </button>
            </div>
          </form>
        </PlanningDialog>
      ) : null}
    </>
  );
}
