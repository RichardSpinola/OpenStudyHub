"use client";
import { useState } from "react";
import { controlAction } from "./actions";
import { HiddenContext } from "./ui";
const days = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];
type Slot = {
  weekday: number;
  start: number;
  end: number;
  locationId: number | null;
};
const time = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const minutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export function ScheduleEditor({
  offerings,
  locations,
  slots,
  returnTo,
}: {
  offerings: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; name: string }>;
  slots: Array<{
    offering_id: number;
    weekday: number;
    starts_at_minutes: number;
    ends_at_minutes: number;
    location_id: number | null;
  }>;
  returnTo: string;
}) {
  const [offering, setOffering] = useState(offerings[0].id);
  const [blocks, setBlocks] = useState<Record<number, Slot[]>>(() =>
    Object.fromEntries(
      offerings.map((o) => [
        o.id,
        slots
          .filter((s) => s.offering_id === o.id)
          .map((s) => ({
            weekday: s.weekday,
            start: s.starts_at_minutes,
            end: s.ends_at_minutes,
            locationId: s.location_id,
          })),
      ]),
    ),
  );
  const current = blocks[offering] ?? [];
  const update = (index: number, patch: Partial<Slot>) =>
    setBlocks({
      ...blocks,
      [offering]: current.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  return (
    <>
      <label>
        Turma da disciplina
        <select
          value={offering}
          onChange={(e) => setOffering(Number(e.target.value))}
        >
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <div className="v2-list">
        {current.map((s, i) => (
          <fieldset key={i}>
            <legend>Bloco {i + 1}</legend>
            <div className="v2-fields">
              <label>
                Dia
                <select
                  value={s.weekday}
                  onChange={(e) =>
                    update(i, { weekday: Number(e.target.value) })
                  }
                >
                  {days.map((d, j) => (
                    <option key={d} value={j + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Início
                <input
                  type="time"
                  value={time(s.start)}
                  onChange={(e) =>
                    update(i, { start: minutes(e.target.value) })
                  }
                />
              </label>
              <label>
                Fim
                <input
                  type="time"
                  value={time(s.end)}
                  onChange={(e) => update(i, { end: minutes(e.target.value) })}
                />
              </label>
              <label>
                Sala
                <select
                  value={s.locationId ?? ""}
                  onChange={(e) =>
                    update(i, {
                      locationId: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">Sem sala</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  setBlocks({
                    ...blocks,
                    [offering]: current.filter((_, j) => i !== j),
                  })
                }
              >
                Remover bloco
              </button>
            </div>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          setBlocks({
            ...blocks,
            [offering]: [
              ...current,
              { weekday: 1, start: 480, end: 540, locationId: null },
            ],
          })
        }
      >
        Adicionar bloco
      </button>
      <form action={controlAction}>
        <HiddenContext
          returnTo={returnTo}
          intent="schedule"
          offeringId={offering}
        />
        <input type="hidden" name="slots" value={JSON.stringify(current)} />
        <button type="submit">Salvar conjunto de horários</button>
      </form>
    </>
  );
}
