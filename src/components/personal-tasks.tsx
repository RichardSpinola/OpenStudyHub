"use client";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconCircleCheck,
  IconCircle,
} from "@tabler/icons-react";
import { useUiText, useUiLanguage } from "./ui-language-provider";
import { PlanningDialog } from "./planning-dialog";
import { academicDateTimeInput } from "@/lib/academic-clock";
import type { PersonalTask } from "@/lib/personal-tasks";
import { saveTaskAction, changeTaskAction } from "@/app/today/tasks/actions";
type Offering = { key: string; label: string };
export function PersonalTasks({
  tasks,
  timeZone,
  offerings,
  compact = false,
  initiallyOpen = false,
}: {
  tasks: PersonalTask[];
  timeZone: string;
  offerings: Offering[];
  compact?: boolean;
  initiallyOpen?: boolean;
}) {
  const tr = useUiText(),
    language = useUiLanguage(),
    router = useRouter();
  const [editing, setEditing] = useState<PersonalTask | null | undefined>(
      initiallyOpen ? null : undefined,
    ),
    [deleting, setDeleting] = useState<PersonalTask | null>(null),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const dates = new Intl.DateTimeFormat(language, {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  });
  const active = tasks.filter((t) => t.completedAt === null),
    completed = tasks.filter((t) => t.completedAt !== null),
    dated = active.filter((t) => t.dueAt !== null),
    undated = active.filter((t) => t.dueAt === null);
  function mutate(
    task: PersonalTask,
    operation: "complete" | "reopen" | "delete",
  ) {
    setMessage("");
    start(async () => {
      try {
        const r = await changeTaskAction(task.id, operation);
        if (!r.ok) {
          setMessage(
            tr(
              "Não foi possível alterar. Tente novamente.",
              "Could not update. Try again.",
            ),
          );
          return;
        }
        setDeleting(null);
        setMessage(tr("Tarefa atualizada.", "Task updated."));
        router.refresh();
      } catch {
        setMessage(
          tr(
            "Não foi possível alterar. Tente novamente.",
            "Could not update. Try again.",
          ),
        );
      }
    });
  }
  const row = (t: PersonalTask) => {
    const offering = offerings.find((o) => o.key === t.offeringKey),
      done = t.completedAt !== null;
    return (
      <li key={t.id} data-completed={done || undefined}>
        <button
          className="task-check"
          type="button"
          disabled={pending}
          aria-label={`${done ? tr("Reabrir", "Reopen") : tr("Concluir", "Complete")}: ${t.title}`}
          onClick={() => mutate(t, done ? "reopen" : "complete")}
        >
          {done ? <IconCircleCheck size={22} /> : <IconCircle size={22} />}
        </button>
        <div className="task-copy">
          <strong>{t.title}</strong>
          <div className="task-meta">
            {t.dueAt !== null ? (
              <time
                dateTime={new Date(t.dueAt).toISOString()}
                data-overdue={(!done && t.dueAt < now) || undefined}
              >
                {!done && t.dueAt < now ? tr("Atrasada · ", "Overdue · ") : ""}
                {dates.format(t.dueAt)}
              </time>
            ) : (
              <span>{tr("Sem prazo", "No deadline")}</span>
            )}
            {offering ? <span>{offering.label}</span> : null}
          </div>
          {!compact && t.description ? <p>{t.description}</p> : null}
        </div>
        <div className="task-row-actions">
          {!compact ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setEditing(t)}
                aria-label={`${tr("Editar", "Edit")}: ${t.title}`}
              >
                <IconPencil size={18} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setDeleting(t)}
                aria-label={`${tr("Excluir", "Delete")}: ${t.title}`}
              >
                <IconTrash size={18} />
              </button>
            </>
          ) : null}
        </div>
      </li>
    );
  };
  return (
    <section
      className={
        compact
          ? "workflow-panel personal-tasks personal-tasks-compact"
          : "personal-tasks"
      }
      data-tour="personal-tasks"
    >
      <div className="section-heading">
        <div>
          <h2>{tr("Minhas tarefas", "My tasks")}</h2>
          {compact ? (
            <span>
              {active.length} {tr("pendente(s)", "pending")}
            </span>
          ) : (
            <p>
              {tr("Prazos no fuso", "Times in")} {timeZone}
            </p>
          )}
        </div>
        <div className="planning-actions">
          <button
            type="button"
            onClick={() => setEditing(null)}
            disabled={pending}
          >
            <IconPlus size={17} />
            {tr("Nova tarefa", "New task")}
          </button>
          {compact ? (
            <Link href="/today/tasks">{tr("Ver todas", "View all")}</Link>
          ) : null}
        </div>
      </div>
      {compact ? (
        <>
          {active.length ? (
            <ul className="personal-task-list">
              {active.slice(0, 3).map(row)}
            </ul>
          ) : (
            <p className="panel-help">
              {tr(
                "Tudo em dia. Adicione uma tarefa para organizar seus estudos.",
                "All caught up. Add a task to plan your studies.",
              )}
            </p>
          )}
          {active.length > 3 ? (
            <p className="panel-help">
              +{active.length - 3} {tr("na sua lista", "in your list")}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="task-groups">
            <section>
              <h3>
                {tr("Com prazo", "With deadline")} <span>{dated.length}</span>
              </h3>
              {dated.length ? (
                <ul className="personal-task-list">{dated.map(row)}</ul>
              ) : (
                <p className="panel-help">
                  {tr("Nenhuma tarefa com prazo.", "No tasks with deadlines.")}
                </p>
              )}
            </section>
            <section>
              <h3>
                {tr("Sem prazo", "No deadline")} <span>{undated.length}</span>
              </h3>
              {undated.length ? (
                <ul className="personal-task-list">{undated.map(row)}</ul>
              ) : (
                <p className="panel-help">
                  {tr(
                    "Nenhuma tarefa sem prazo.",
                    "No tasks without deadlines.",
                  )}
                </p>
              )}
            </section>
          </div>
          <details className="task-completed">
            <summary>
              <IconCircleCheck size={18} />
              {tr("Concluídas", "Completed")} · {completed.length}
            </summary>
            {completed.length ? (
              <ul className="personal-task-list">{completed.map(row)}</ul>
            ) : (
              <p className="panel-help">
                {tr(
                  "As tarefas concluídas aparecerão aqui.",
                  "Completed tasks will appear here.",
                )}
              </p>
            )}
          </details>
        </>
      )}
      <p role="status" className="planning-status">
        {pending ? tr("Salvando…", "Saving…") : message}
      </p>
      {editing !== undefined ? (
        <TaskEditor
          task={editing}
          offerings={offerings}
          timeZone={timeZone}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {deleting ? (
        <PlanningDialog
          title={tr("Excluir tarefa?", "Delete task?")}
          onClose={() => {
            if (!pending) setDeleting(null);
          }}
        >
          <p>{deleting.title}</p>
          <p>
            {tr(
              "Esta ação remove somente esta tarefa pessoal.",
              "This only removes this personal task.",
            )}
          </p>
          <div className="planning-actions">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              {tr("Cancelar", "Cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => mutate(deleting, "delete")}
            >
              <IconTrash size={18} />
              {tr("Excluir tarefa", "Delete task")}
            </button>
          </div>
          {message ? <p role="alert">{message}</p> : null}
        </PlanningDialog>
      ) : null}
    </section>
  );
}
function TaskEditor({
  task,
  offerings,
  timeZone,
  onClose,
}: {
  task: PersonalTask | null;
  offerings: Offering[];
  timeZone: string;
  onClose: () => void;
}) {
  const tr = useUiText(),
    router = useRouter(),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  return (
    <PlanningDialog
      title={
        task ? tr("Editar tarefa", "Edit task") : tr("Nova tarefa", "New task")
      }
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form
        className="planning-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setError("");
          start(async () => {
            try {
              const result = await saveTaskAction({
                id: task?.id,
                title: String(form.get("title") ?? ""),
                description: String(form.get("description") ?? ""),
                offeringKey: String(form.get("offering") ?? ""),
                due: String(form.get("due") ?? ""),
              });
              if (!result.ok) {
                setError(
                  result.error === "limit"
                    ? tr(
                        "Limite de 1.000 tarefas atingido. Remova as que não usa.",
                        "1,000 task limit reached. Remove unused tasks.",
                      )
                    : tr(
                        "Não foi possível salvar. Confira o título, horário e disciplina.",
                        "Could not save. Check title, time and subject.",
                      ),
                );
                return;
              }
              router.refresh();
              onClose();
            } catch {
              setError(
                tr(
                  "Não foi possível salvar. Tente novamente.",
                  "Could not save. Try again.",
                ),
              );
            }
          });
        }}
      >
        <label>
          {tr("Título", "Title")}
          <input
            name="title"
            autoFocus
            required
            maxLength={180}
            defaultValue={task?.title ?? ""}
            disabled={pending}
          />
        </label>
        <label>
          {tr("Descrição (opcional)", "Description (optional)")}
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={task?.description ?? ""}
            disabled={pending}
          />
        </label>
        <div className="planning-form-columns">
          <label>
            {tr("Prazo (opcional)", "Deadline (optional)")}
            <input
              type="datetime-local"
              name="due"
              defaultValue={
                task?.dueAt
                  ? academicDateTimeInput(new Date(task.dueAt), timeZone)
                  : ""
              }
              disabled={pending}
            />
            <small>{timeZone}</small>
          </label>
          <label>
            {tr("Disciplina (opcional)", "Subject (optional)")}
            <select
              name="offering"
              defaultValue={
                offerings.some((o) => o.key === task?.offeringKey)
                  ? (task?.offeringKey ?? "")
                  : ""
              }
              disabled={pending}
            >
              <option value="">{tr("Sem disciplina", "No subject")}</option>
              {offerings.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="planning-actions">
          <button type="button" disabled={pending} onClick={onClose}>
            {tr("Cancelar", "Cancel")}
          </button>
          <button type="submit" disabled={pending}>
            {pending
              ? tr("Salvando…", "Saving…")
              : tr("Salvar tarefa", "Save task")}
          </button>
        </div>
      </form>
    </PlanningDialog>
  );
}
