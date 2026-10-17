"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useUiText } from "./ui-language-provider";
import type { AgendaSlot } from "@/lib/academic";
import { formatMinutes, joinLocation } from "@/lib/academic-format";
import { weeklyScheduleRows } from "@/lib/weekly-layout";
export const weekdays = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
const weekdaysEn = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export function AcademicTimeGrid({
  slots,
  today,
}: {
  slots: AgendaSlot[];
  today: number;
}) {
  const tr = useUiText();
  const rows = weeklyScheduleRows(slots);
  const classDays = [
    ...new Set(rows.flatMap((r) => r.slots.map((s) => s.weekday))),
  ].sort((a, b) => a - b);
  const [allDays, setAllDays] = useState(false);
  const [selected, setSelected] = useState(
    classDays.includes(today) ? today : (classDays[0] ?? today),
  );
  const [detail, setDetail] = useState<AgendaSlot | null>(null);
  const visibleDays = allDays ? weekdays.map((_, i) => i + 1) : classDays;
  return (
    <section className="weekly-board" aria-labelledby="week-grid-title">
      <header className="weekly-board-heading">
        <div>
          <h2 id="week-grid-title">
            {tr("Grade da semana", "Weekly schedule")}
          </h2>
          <div
            className="weekly-view-switch"
            role="group"
            aria-label={tr("Dias exibidos", "Displayed days")}
          >
            <button
              type="button"
              aria-pressed={!allDays}
              onClick={() => setAllDays(false)}
            >
              {tr("Dias com aulas", "Class days")}
            </button>
            <button
              type="button"
              aria-pressed={allDays}
              onClick={() => setAllDays(true)}
            >
              {tr("Semana completa", "Full week")}
            </button>
          </div>
          <small>
            {rows.reduce((n, r) => n + r.slots.length, 0)}{" "}
            {tr("aulas", "classes")}
          </small>
        </div>
      </header>
      {rows.length ? (
        <>
          <div
            className="weekly-day-picker"
            role="group"
            aria-label={tr("Dia da semana", "Day of week")}
          >
            {visibleDays.map((day) => (
              <button
                type="button"
                key={day}
                aria-pressed={selected === day}
                onClick={() => setSelected(day)}
              >
                {tr(weekdays[day - 1], weekdaysEn[day - 1])}
              </button>
            ))}
          </div>
          <div className="weekly-scroll">
            <table className="weekly-compact-table">
              <caption className="sr-only">
                {tr(
                  "Aulas por horário e dia da semana. Cada linha mostra o intervalo cadastrado.",
                  "Classes by time and weekday. Each row shows its scheduled interval.",
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{tr("Horário", "Time")}</th>
                  {visibleDays.map((day) => (
                    <th
                      scope="col"
                      key={day}
                      data-selected={day === selected}
                      data-today={day === today}
                    >
                      {tr(weekdays[day - 1], weekdaysEn[day - 1])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.start}-${row.end}`}>
                    <th scope="row">
                      <time>{formatMinutes(row.start)}</time>
                      <span aria-hidden="true">–</span>
                      <time>{formatMinutes(row.end)}</time>
                    </th>
                    {visibleDays.map((day) => (
                      <td
                        key={day}
                        data-selected={day === selected}
                        data-today={day === today}
                      >
                        {row.slots
                          .filter((s) => s.weekday === day)
                          .map((slot) => (
                            <button
                              key={slot.slotId}
                              type="button"
                              className="weekly-class-item"
                              aria-label={`${slot.subjectName}, ${formatMinutes(slot.startsAtMinutes)}–${formatMinutes(slot.endsAtMinutes)}, ${joinLocation([slot.locationName, slot.room]) ?? tr("Sala não informada", "Room not specified")}, ${slot.instructorName ?? tr("Professor não informado", "Instructor not specified")}`}
                              onClick={() => setDetail(slot)}
                            >
                              <strong>
                                {slot.subjectShortName ?? slot.subjectName}
                              </strong>
                              <small>
                                {joinLocation([slot.locationName, slot.room]) ??
                                  tr(
                                    "Sala não informada",
                                    "Room not specified",
                                  )}
                              </small>
                            </button>
                          ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="useful-empty">
          <strong>
            {tr(
              "Nenhuma aula cadastrada nesta semana.",
              "No classes scheduled this week.",
            )}
          </strong>
        </div>
      )}
      {detail && <LessonDialog slot={detail} close={() => setDetail(null)} />}
    </section>
  );
}
function LessonDialog({
  slot,
  close,
}: {
  slot: AgendaSlot;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    tr = useUiText();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="weekly-lesson-dialog"
      aria-labelledby="lesson-detail-title"
      onClose={() => {
        if (!ref.current?.open) close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <header>
        <h2 id="lesson-detail-title">{slot.subjectName}</h2>
        <button
          type="button"
          onClick={close}
          aria-label={tr("Fechar detalhes da aula", "Close class details")}
        >
          ×
        </button>
      </header>
      <dl>
        <dt>{tr("Horário", "Time")}</dt>
        <dd>
          {formatMinutes(slot.startsAtMinutes)}–
          {formatMinutes(slot.endsAtMinutes)}
        </dd>
        <dt>{tr("Local", "Location")}</dt>
        <dd>
          {joinLocation([slot.locationName, slot.room]) ??
            tr("Sala não informada", "Room not specified")}
        </dd>
        <dt>{tr("Professor", "Instructor")}</dt>
        <dd>
          {slot.instructorName ??
            tr("Professor não informado", "Instructor not specified")}
        </dd>
      </dl>
      <Link className="primary-link" href={`/subjects/${slot.subjectId}`}>
        {tr("Abrir disciplina", "Open subject")}
      </Link>
    </dialog>
  );
}
