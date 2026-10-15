"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { controlAction } from "./actions";
import { HiddenContext } from "./hidden-context";
const days = [
  ["Segunda", "Monday"],
  ["Terça", "Tuesday"],
  ["Quarta", "Wednesday"],
  ["Quinta", "Thursday"],
  ["Sexta", "Friday"],
  ["Sábado", "Saturday"],
  ["Domingo", "Sunday"],
] as const;
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
  const tr = useUiText();
  const [error, setError] = useState("");
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
  const draftKey = "osh-admin-schedule:" + returnTo;
  const [dirty, setDirty] = useState(false);
  const search = useSearchParams();
  const successful = search.has("ok"),
    rejected = search.has("error");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const parsed = JSON.parse(
          sessionStorage.getItem(draftKey) ?? "{}",
        ) as Record<number, Slot[]>;
        const submitted = Number(
          sessionStorage.getItem(draftKey + ":submitted"),
        );
        if (successful && submitted) {
          delete parsed[submitted];
          sessionStorage.removeItem(draftKey + ":submitted");
          sessionStorage.setItem(draftKey, JSON.stringify(parsed));
        }
        const safe = Object.fromEntries(
          offerings
            .filter((o) => Array.isArray(parsed[o.id]))
            .map((o) => [o.id, parsed[o.id]]),
        );
        const initial = Object.fromEntries(
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
        );
        setBlocks({ ...initial, ...safe });
        setDirty(Object.keys(safe).length > 0);
        const selected = Number(sessionStorage.getItem(draftKey + ":selected"));
        if (offerings.some((o) => o.id === selected)) setOffering(selected);
      } catch {
        /* Draft storage is optional. */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [draftKey, offerings, slots, successful, rejected]);
  const current = blocks[offering] ?? [];
  function keep(next: Record<number, Slot[]>) {
    setBlocks(next);
    setDirty(true);
    try {
      const pending = JSON.parse(sessionStorage.getItem(draftKey) ?? "{}");
      pending[offering] = next[offering];
      sessionStorage.setItem(draftKey, JSON.stringify(pending));
      sessionStorage.setItem(draftKey + ":selected", String(offering));
    } catch {
      /* optional draft */
    }
  }

  const update = (index: number, patch: Partial<Slot>) =>
    keep({
      ...blocks,
      [offering]: current.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  return (
    <div className="admin-schedule-editor">
      <p>
        Escolha a disciplina, organize seus horários de aula e salve. Esses
        horários se repetem toda semana; uma aula em uma data específica deve
        ser criada em Eventos e provas.
      </p>
      <label>
        <UiCopy pt="Disciplina e período" en="Subject offering" />
        <select
          value={offering}
          onChange={(e) => {
            setOffering(Number(e.target.value));
            setError("");
            try {
              sessionStorage.setItem(draftKey + ":selected", e.target.value);
            } catch {}
          }}
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
            <legend>
              <UiCopy pt="Aula" en="Block" /> {i + 1}
            </legend>
            <div className="v2-fields">
              <label>
                <UiCopy pt="Dia" en="Day" />
                <select
                  value={s.weekday}
                  onChange={(e) =>
                    update(i, { weekday: Number(e.target.value) })
                  }
                >
                  {days.map(([pt, en], j) => (
                    <option key={pt} value={j + 1}>
                      <UiCopy pt={pt} en={en} />
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <UiCopy pt="Início" en="Start" />
                <input
                  type="time"
                  value={time(s.start)}
                  onChange={(e) =>
                    update(i, { start: minutes(e.target.value) })
                  }
                />
              </label>
              <label>
                <UiCopy pt="Fim" en="End" />
                <input
                  type="time"
                  value={time(s.end)}
                  onChange={(e) => update(i, { end: minutes(e.target.value) })}
                />
              </label>
              <label>
                <UiCopy pt="Sala" en="Room" />
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
                  <option value="">
                    <UiCopy pt="Sem sala" en="No room" />
                  </option>
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
                  keep({
                    ...blocks,
                    [offering]: current.filter((_, j) => i !== j),
                  })
                }
              >
                <UiCopy pt="Remover bloco" en="Remove slot" />
              </button>
            </div>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          keep({
            ...blocks,
            [offering]: [
              ...current,
              { weekday: 1, start: 480, end: 540, locationId: null },
            ],
          })
        }
      >
        <UiCopy pt="Adicionar horário de aula" en="Add slot" />
      </button>
      {dirty && (
        <p role="status">
          Alterações ainda não salvas. O botão abaixo salva somente a disciplina
          selecionada.
        </p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      <form
        action={controlAction}
        onSubmit={(event) => {
          if (
            current.some(
              (s) =>
                !Number.isInteger(s.start) ||
                !Number.isInteger(s.end) ||
                s.start < 0 ||
                s.end > 1440 ||
                s.end <= s.start,
            )
          ) {
            event.preventDefault();
            setError(
              tr(
                "Confira os horários: o fim deve ser posterior ao início. Seus blocos foram mantidos.",
                "Check the times: the end must follow the start. Your slots were kept.",
              ),
            );
            return;
          }
          if (
            current.some((s, i) =>
              current.some(
                (other, j) =>
                  i !== j &&
                  s.weekday === other.weekday &&
                  s.start < other.end &&
                  s.end > other.start,
              ),
            )
          ) {
            event.preventDefault();
            setError(
              tr(
                "Há blocos sobrepostos no mesmo dia. Ajuste os horários antes de salvar.",
                "Slots overlap on the same day. Adjust the times before saving.",
              ),
            );
            return;
          }
          setError("");
          try {
            sessionStorage.setItem(draftKey + ":submitted", String(offering));
            sessionStorage.setItem(draftKey + ":selected", String(offering));
          } catch {
            /* optional draft */
          }
        }}
      >
        <HiddenContext
          returnTo={returnTo}
          intent="schedule"
          offeringId={offering}
        />
        <input type="hidden" name="slots" value={JSON.stringify(current)} />
        <PendingSubmitButton
          pendingLabel={tr("Salvando horários…", "Saving schedule…")}
        >
          <UiCopy pt="Salvar horários desta disciplina" en="Save schedule" />
        </PendingSubmitButton>
      </form>
    </div>
  );
}
