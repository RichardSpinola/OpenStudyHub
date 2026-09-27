"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useState } from "react";
import Link from "next/link";
import type { AgendaSlot } from "@/lib/academic";
import { formatMinutes, joinLocation } from "@/lib/academic-format";

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
  const [selected, setSelected] = useState(today);
  const startHour = slots.length
    ? Math.max(
        0,
        Math.floor(
          Math.min(...slots.map((slot) => slot.startsAtMinutes)) / 60,
        ) - 1,
      )
    : 8;
  const endHour = slots.length
    ? Math.min(
        24,
        Math.max(
          startHour + 2,
          Math.ceil(Math.max(...slots.map((slot) => slot.endsAtMinutes)) / 60) +
            1,
        ),
      )
    : 18;
  return (
    <section className="time-grid-panel" aria-labelledby="week-grid-title">
      <div className="section-heading">
        <h2 id="week-grid-title">
          <UiCopy pt="Grade da semana" en="Weekly schedule" />
        </h2>
        <span>
          {slots.length}
          <UiCopy pt="aula(s)" en="class(es)" />
        </span>
      </div>
      <div
        className="time-grid-day-picker"
        role="group"
        aria-label={tr("Dia da semana", "Day of week")}
      >
        {weekdays.map((day, index) => (
          <button
            key={day}
            type="button"
            aria-pressed={selected === index + 1}
            onClick={() => setSelected(index + 1)}
          >
            {tr(day, weekdaysEn[index])}
          </button>
        ))}
      </div>
      <div className="time-grid-scroll">
        <div
          className="time-grid"
          style={{ "--grid-hours": endHour - startHour } as React.CSSProperties}
        >
          <div className="time-grid-corner" aria-hidden="true">
            <UiCopy pt="Hora" en="Time" />
          </div>
          {weekdays.map((day, index) => (
            <div
              key={day}
              className="time-grid-day-heading"
              data-selected={selected === index + 1}
            >
              {tr(day, weekdaysEn[index])}
            </div>
          ))}
          <div className="time-grid-hours" aria-hidden="true">
            {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
              <span key={index} style={{ top: `${index * 60}px` }}>
                {formatMinutes((startHour + index) * 60)}
              </span>
            ))}
          </div>
          {weekdays.map((day, index) => (
            <div
              key={day}
              className="time-grid-day"
              data-selected={selected === index + 1}
              data-today={today === index + 1}
            >
              {slots
                .filter((slot) => slot.weekday === index + 1)
                .map((slot) => {
                  const top = Math.max(
                    0,
                    slot.startsAtMinutes - startHour * 60,
                  );
                  const height = Math.max(
                    36,
                    slot.endsAtMinutes - slot.startsAtMinutes,
                  );
                  const location = joinLocation([slot.locationName, slot.room]);
                  return (
                    <details
                      key={slot.slotId}
                      className="time-grid-event"
                      style={{ top: `${top}px`, minHeight: `${height}px` }}
                    >
                      <summary>
                        <strong>
                          {slot.subjectShortName ?? slot.subjectName}
                        </strong>
                        <time>
                          {formatMinutes(slot.startsAtMinutes)}–
                          {formatMinutes(slot.endsAtMinutes)}
                        </time>
                        <span>
                          {location ??
                            tr("Sala não informada", "Room not specified")}
                        </span>
                      </summary>
                      <div className="time-grid-popover">
                        <strong>{slot.subjectName}</strong>
                        <span>
                          {slot.instructorName ??
                            tr(
                              "Professor não informado",
                              "Instructor not specified",
                            )}
                        </span>
                        <span>
                          {location ??
                            tr("Sala não informada", "Room not specified")}
                        </span>
                        <Link href={`/subjects/${slot.subjectId}`}>
                          <UiCopy pt="Abrir disciplina" en="Open subject" />
                        </Link>
                      </div>
                    </details>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      {slots.length === 0 ? (
        <p className="panel-help">
          <UiCopy
            pt="Nenhuma aula cadastrada nesta semana."
            en="No classes scheduled this week."
          />
        </p>
      ) : null}
    </section>
  );
}
