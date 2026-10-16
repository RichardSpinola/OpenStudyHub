"use client";
import { IconClock } from "@tabler/icons-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useUiText } from "@/components/ui-language-provider";
import {
  clockText,
  defaultFocus,
  elapsedFocus,
  nextFocusPhase,
  readFocus,
  remainingFocus,
  type FocusState,
} from "@/lib/focus-clock";
type FocusContextType = {
  state: FocusState;
  setState: Dispatch<SetStateAction<FocusState>>;
  now: number;
  ready: boolean;
  enabled: boolean;
};
const FocusContext = createContext<FocusContextType | null>(null);
export function FocusProvider({
  userId,
  enabled,
  children,
}: {
  userId: number;
  enabled: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState(defaultFocus),
    [ready, setReady] = useState(false),
    [now, setNow] = useState(0);
  const key = `osh:focus:${userId}`;
  useEffect(() => {
    const restore = () => {
      try {
        setState(readFocus(localStorage.getItem(key)));
      } catch {
        setState(defaultFocus());
      }
      setNow(Date.now());
      setReady(true);
    };
    restore();
    const storage = (e: StorageEvent) => {
      if (e.key === key) restore();
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [key]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {}
  }, [state, ready, key]);
  useEffect(() => {
    if (!enabled || (!state.deadline && !state.startedAt)) return;
    const tick = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, state.deadline, state.startedAt]);
  const update = useCallback<Dispatch<SetStateAction<FocusState>>>((value) => {
    setNow(Date.now());
    setState(value);
  }, []);
  return (
    <FocusContext.Provider
      value={{ state, setState: update, now, ready, enabled }}
    >
      {children}
    </FocusContext.Provider>
  );
}
export function FocusControls({ compact = false }: { compact?: boolean }) {
  const ctx = useContext(FocusContext),
    tr = useUiText();
  if (!ctx || !ctx.enabled) return null;
  const { state: s, setState: set, now, ready } = ctx;
  const remaining = remainingFocus(s, now),
    elapsed = elapsedFocus(s, now),
    finished = s.deadline !== null && remaining === 0;
  const names = {
    focus: tr("Estudo", "Study"),
    short: tr("Pausa curta", "Short break"),
    long: tr("Pausa longa", "Long break"),
  };
  return (
    <div className="focus-controls">
      <section aria-label="Pomodoro">
        <p className="page-kicker">Pomodoro · {names[s.phase]}</p>
        <strong
          className="focus-time"
          aria-label={tr("Tempo restante", "Time remaining")}
        >
          {clockText(remaining)}
        </strong>
        <p role="status">
          {finished
            ? tr(
                "Ciclo concluído. Escolha a próxima fase quando estiver pronto.",
                "Cycle complete. Choose the next phase when ready.",
              )
            : tr("Ciclos de estudo concluídos:", "Completed study cycles:") +
              " " +
              s.cycles}
        </p>
        <div className="tool-actions">
          {finished ? (
            <button
              disabled={!ready}
              onClick={() => {
                set(nextFocusPhase(s));
              }}
            >
              {tr(
                s.phase === "focus" ? "Ir para pausa" : "Voltar ao estudo",
                s.phase === "focus" ? "Go to break" : "Back to study",
              )}
            </button>
          ) : (
            <button
              disabled={!ready}
              onClick={() => {
                const t = Date.now();
                set({
                  ...s,
                  active: true,
                  remaining: remainingFocus(s, t),
                  deadline: s.deadline === null ? t + s.remaining : null,
                });
              }}
            >
              {s.deadline === null
                ? tr(
                    s.active ? "Continuar" : "Iniciar",
                    s.active ? "Resume" : "Start",
                  )
                : tr("Pausar", "Pause")}
            </button>
          )}
          <button
            disabled={!ready}
            onClick={() =>
              set({
                ...s,
                remaining: s.durations[s.phase] * 60000,
                deadline: null,
                active: false,
              })
            }
          >
            {tr("Reiniciar ciclo", "Reset cycle")}
          </button>
        </div>
        {!compact ? (
          <details>
            <summary>{tr("Duração dos ciclos", "Cycle lengths")}</summary>
            <form
              className="tool-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  durations = {
                    focus: Number(f.get("focus")),
                    short: Number(f.get("short")),
                    long: Number(f.get("long")),
                  };
                if (
                  !Object.values(durations).every(
                    (n) => Number.isInteger(n) && n >= 1 && n <= 180,
                  )
                )
                  return;
                set({
                  ...s,
                  durations,
                  remaining: durations[s.phase] * 60000,
                  deadline: null,
                  active: false,
                });
              }}
            >
              <fieldset disabled={s.deadline !== null && !finished}>
                <legend>{tr("Minutos", "Minutes")}</legend>
                {(["focus", "short", "long"] as const).map((k) => (
                  <label key={k}>
                    {names[k]}
                    <input
                      name={k}
                      type="number"
                      min={1}
                      max={180}
                      step={1}
                      required
                      defaultValue={s.durations[k]}
                    />
                  </label>
                ))}
                <button>{tr("Aplicar tempos", "Apply times")}</button>
              </fieldset>
            </form>
          </details>
        ) : null}
      </section>
      {!compact ? (
        <section aria-label={tr("Cronômetro", "Stopwatch")}>
          <p className="page-kicker">{tr("Cronômetro", "Stopwatch")}</p>
          <strong className="focus-time">{clockText(elapsed)}</strong>
          <div className="tool-actions">
            <button
              disabled={!ready}
              onClick={() => {
                const t = Date.now();
                set({
                  ...s,
                  elapsed: elapsedFocus(s, t),
                  startedAt: s.startedAt === null ? t : null,
                });
              }}
            >
              {s.startedAt === null
                ? tr("Iniciar / continuar", "Start / resume")
                : tr("Pausar", "Pause")}
            </button>
            <button
              disabled={!s.startedAt || s.laps.length >= 100}
              onClick={() =>
                set({
                  ...s,
                  laps: [elapsedFocus(s, Date.now()), ...s.laps].slice(0, 100),
                })
              }
            >
              {tr("Marcar volta", "Lap")}
            </button>
            <button
              onClick={() =>
                set({ ...s, elapsed: 0, startedAt: null, laps: [] })
              }
            >
              {tr("Zerar", "Reset")}
            </button>
          </div>
          {s.laps.length ? (
            <ol className="focus-laps">
              {s.laps.map((lap, i) => (
                <li key={i}>
                  {s.laps.length - i} · {clockText(lap)}
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
export function FocusChip() {
  const ctx = useContext(FocusContext),
    tr = useUiText(),
    dialog = useRef<HTMLDialogElement>(null);
  if (!ctx?.enabled) return null;
  const { state: s, now, ready } = ctx;
  return (
    <div className="notification-center focus-chip">
      <button
        type="button"
        aria-label={tr("Abrir Pomodoro", "Open Pomodoro")}
        onClick={() => dialog.current?.showModal()}
        title="Pomodoro"
      >
        <IconClock size={20} stroke={1.8} aria-hidden="true" />
        {ready && s.active ? (
          <small className="focus-chip-time">
            {clockText(remainingFocus(s, now))}
          </small>
        ) : null}
      </button>
      <dialog
        ref={dialog}
        className="focus-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
        aria-label="Pomodoro"
      >
        <header>
          <h2>Pomodoro</h2>
          <button
            aria-label={tr("Fechar", "Close")}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <FocusControls compact />
        <Link href="/extras/focus" onClick={() => dialog.current?.close()}>
          {tr("Abrir Foco e cronômetro →", "Open Focus and stopwatch →")}
        </Link>
      </dialog>
    </div>
  );
}
