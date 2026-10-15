"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { controlAction } from "./actions";
import { HiddenContext } from "./hidden-context";
import { useUiText } from "@/components/ui-language-provider";
function Save() {
  const { pending } = useFormStatus();
  const tr = useUiText();
  return (
    <button disabled={pending}>
      {pending ? tr("Salvando…", "Saving…") : tr("Salvar evento", "Save event")}
    </button>
  );
}
export function EventForm({
  targets,
  canExam,
  institutionId,
  returnTo,
  zone,
  event,
}: {
  targets: Array<{ value: string; name: string }>;
  canExam: boolean;
  institutionId: number;
  returnTo: string;
  zone: string;
  event?: {
    id: number;
    title: string;
    kind: string;
    audience: string;
    start: string;
    end: string;
    description: string;
  };
}) {
  const tr = useUiText(),
    [kind, setKind] = useState(event?.kind ?? "event"),
    [audience, setAudience] = useState(event?.audience ?? ""),
    [error, setError] = useState("");
  const choices = targets.filter(
    (t) => kind !== "class" || t.value.startsWith("offering:"),
  );
  return (
    <form
      action={controlAction}
      className="v2-fields"
      onSubmit={(e) => {
        const f = new FormData(e.currentTarget);
        if (String(f.get("end")) <= String(f.get("start"))) {
          e.preventDefault();
          setError(
            tr(
              "O fim precisa ser depois do início. Confira as datas e os horários.",
              "The end must follow the start. Check the dates and times.",
            ),
          );
        } else setError("");
      }}
    >
      <HiddenContext
        returnTo={returnTo}
        intent="eventSave"
        institutionId={institutionId}
        id={event?.id ?? ""}
      />
      <label>
        {tr("Título", "Title")}
        <input
          name="title"
          defaultValue={event?.title}
          required
          maxLength={180}
        />
      </label>
      <label>
        {tr("Tipo", "Type")}
        <select
          name="kind"
          value={kind}
          onChange={(e) => {
            const next = e.target.value;
            setKind(next);
            if (next === "class" && !audience.startsWith("offering:"))
              setAudience("");
          }}
        >
          <option value="event">
            {tr("Evento acadêmico", "Academic event")}
          </option>
          <option
            value="class"
            disabled={!targets.some((t) => t.value.startsWith("offering:"))}
          >
            {tr("Aula excepcional", "Exceptional class")}
          </option>
          {canExam && (
            <option value="exam">
              {tr(
                "Prova com restrição de ferramentas",
                "Exam with tool restrictions",
              )}
            </option>
          )}
        </select>
      </label>
      <label>
        {tr(
          kind === "class" ? "Disciplina da aula" : "Quem verá este evento",
          kind === "class" ? "Class subject" : "Who will see this event",
        )}
        <select
          name="audience"
          required
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          <option value="">
            {tr("Escolha o público", "Choose the audience")}
          </option>
          {choices.map((t) => (
            <option value={t.value} key={t.value}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr("Início", "Start")}
        <input
          type="datetime-local"
          name="start"
          required
          defaultValue={event?.start}
        />
      </label>
      <label>
        {tr("Fim", "End")}
        <input
          type="datetime-local"
          name="end"
          required
          defaultValue={event?.end}
        />
      </label>
      <label>
        {tr("Descrição (opcional)", "Description (optional)")}
        <textarea
          name="description"
          maxLength={4000}
          defaultValue={event?.description}
        />
      </label>
      <p className="admin-field-help">
        {tr("Horário da instituição:", "Institution time zone:")} {zone}.{" "}
        {kind === "class"
          ? tr(
              "Esta aula acontece apenas na data indicada. Os horários semanais continuam como estão.",
              "This class occurs only on the specified date. Weekly schedules are kept.",
            )
          : kind === "exam"
            ? tr(
                "Durante este intervalo, Chat, Notas, Biblioteca e Extras ficam bloqueados para esse público. Home, Hoje, Disciplinas, busca e atalhos continuam disponíveis.",
                "During this interval, Chat, Notes, Library and Extras are blocked for this audience. Home, Today, Subjects, search and shortcuts remain available.",
              )
            : tr(
                "O evento aparece em Hoje e nas disciplinas desse público.",
                "The event appears in Today and this audience's subjects.",
              )}
      </p>
      {error && <p role="alert">{error}</p>}
      <Save />
    </form>
  );
}
