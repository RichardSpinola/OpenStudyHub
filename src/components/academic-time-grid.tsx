"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useUiText } from "./ui-language-provider";
import type { AgendaSlot } from "@/lib/academic";
import { formatMinutes, joinLocation } from "@/lib/academic-format";
import { weeklyLayout } from "@/lib/weekly-layout";
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
  const [selected, setSelected] = useState(today),
    [detail, setDetail] = useState<AgendaSlot | null>(null);
  const layout = weeklyLayout(slots);
  return (
    <section className="weekly-board" aria-labelledby="week-grid-title">
      <header className="weekly-board-heading">
        <div>
          <h2 id="week-grid-title">
            {tr("Grade da semana", "Weekly schedule")}
          </h2>
          <small>
            {layout.events.length} {tr("aula(s)", "class(es)")}
            {layout.events.length
              ? ` · ${formatMinutes(layout.start)}–${formatMinutes(layout.end)}`
              : ""}
          </small>
        </div>
      </header>
      {layout.events.length ? (
        <>
          <div
            className="weekly-day-picker"
            role="group"
            aria-label={tr("Dia da semana", "Day of week")}
          >
            {weekdays.map((day, i) => (
              <button
                key={day}
                type="button"
                aria-pressed={selected === i + 1}
                onClick={() => setSelected(i + 1)}
              >
                {tr(day, weekdaysEn[i])}
              </button>
            ))}
          </div>
          <div className="weekly-scroll">
            <div
              className="weekly-table"
              style={
                {
                  "--calendar-rows": layout.rows,
                  "--calendar-hours": (layout.end - layout.start) / 60,
                } as CSSProperties
              }
            >
              <span className="weekly-corner">{tr("Hora", "Time")}</span>
              {weekdays.map((day, i) => (
                <div
                  className="weekly-day-label"
                  key={day}
                  data-selected={selected === i + 1}
                  style={{ "--calendar-day": i + 2 } as CSSProperties}
                >
                  {tr(day, weekdaysEn[i])}
                </div>
              ))}
              {weekdays.map((day, i) => (
                <div
                  key={day}
                  className="weekly-day-track"
                  data-selected={selected === i + 1}
                  data-today={today === i + 1}
                  style={
                    {
                      "--calendar-day": i + 2,
                      gridRow: `2 / span ${layout.rows}`,
                    } as CSSProperties
                  }
                />
              ))}
              {Array.from(
                { length: (layout.end - layout.start) / 60 + 1 },
                (_, i) => (
                  <div
                    key={i}
                    className="weekly-hour-line"
                    data-start={i === 0}
                    style={{ gridRow: i === 0 ? 2 : i * 12 + 1 }}
                  >
                    <span className="weekly-hour-label">
                      {formatMinutes(layout.start + i * 60)}
                    </span>
                  </div>
                ),
              )}
              {layout.events.map(({ slot, row, span, lane, lanes }) => (
                <button
                  key={slot.slotId}
                  type="button"
                  className="weekly-lesson"
                  data-selected={selected === slot.weekday}
                  style={
                    {
                      "--calendar-day": slot.weekday + 1,
                      gridRow: `${row} / span ${span}`,
                      width: `calc((100% - 6px) / ${lanes})`,
                      marginLeft: `calc(${lane} * (100% - 6px) / ${lanes} + 3px)`,
                    } as CSSProperties
                  }
                  onClick={() => setDetail(slot)}
                  aria-label={`${slot.subjectName}, ${formatMinutes(slot.startsAtMinutes)}–${formatMinutes(slot.endsAtMinutes)}, ${joinLocation([slot.locationName, slot.room]) ?? tr("Sala não informada", "Room not specified")}, ${slot.instructorName ?? tr("Professor não informado", "Instructor not specified")}`}
                >
                  <strong>{slot.subjectShortName ?? slot.subjectName}</strong>
                  <time>
                    {formatMinutes(slot.startsAtMinutes)}–
                    {formatMinutes(slot.endsAtMinutes)}
                  </time>
                  <small>
                    {joinLocation([slot.locationName, slot.room]) ??
                      tr("Sala não informada", "Room not specified")}
                  </small>
                </button>
              ))}
            </div>
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
      {detail ? (
        <LessonDialog slot={detail} close={() => setDetail(null)} />
      ) : null}
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
