"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";
import {
  mineChordTargets,
  mineNeighbors,
  placeMinesForBoard,
  slide2048,
  spawn2048,
} from "@/lib/minigames";

type Game = "snake" | "2048" | "minesweeper";
type Direction = "left" | "right" | "up" | "down";

export function LocalGame({ game }: { game: Game }) {
  if (game === "snake") return <Snake />;
  if (game === "2048") return <TwentyFortyEight />;
  return <Minesweeper />;
}

function TwentyFortyEight() {
  const tr = useUiText();
  const [state, setState] = useState(() => ({
    grid: spawn2048(
      spawn2048(Array(16).fill(0) as number[], () => 0.25),
      () => 0.75,
    ),
    score: 0,
  }));
  const [best, setBest] = useState(0);
  const [previous, setPrevious] = useState<{
    grid: number[];
    score: number;
  } | null>(null);
  const [movePulse, setMovePulse] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        setState({
          grid: spawn2048(spawn2048(Array(16).fill(0) as number[])),
          score: 0,
        }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setBest(Number(localStorage.getItem("osh-game-2048-best") || 0));
      } catch {
        /* local storage is optional */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function move(direction: Direction) {
    const result = slide2048(state.grid, direction);
    if (!result.moved) return;
    setLastGain(result.gained);
    setMovePulse((value) => value + 1);
    setPrevious(state);
    setState({
      grid: spawn2048(result.grid),
      score: state.score + result.gained,
    });
  }
  useEffect(() => {
    if (state.score <= best) return;
    try {
      localStorage.setItem("osh-game-2048-best", String(state.score));
    } catch {
      /* local storage is optional */
    }
  }, [state.score, best]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const direction = (
        {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
        } as Record<string, Direction>
      )[event.key];
      if (
        !direction ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      event.preventDefault();
      move(direction);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const over =
    !state.grid.includes(0) &&
    (["left", "right", "up", "down"] as Direction[]).every(
      (direction) => !slide2048(state.grid, direction).moved,
    );
  return (
    <section className="local-game game-2048">
      <div className="game-dashboard">
        <span>
          <small>
            <UiCopy pt="PONTOS" en="SCORE" />
          </small>
          <strong>{state.score}</strong>
        </span>
        <span>
          <small>
            <UiCopy pt="RECORDE" en="HIGH SCORE" />
          </small>
          <strong>{Math.max(best, state.score)}</strong>
        </span>
      </div>
      <p className="game-hint">
        <UiCopy
          pt="Una números iguais com as setas ou deslizando o tabuleiro."
          en="Join equal numbers with the arrow keys or swipe across the board."
        />
      </p>
      <div
        className="game-2048-grid"
        role="grid"
        aria-label={tr("Tabuleiro 2048", "2048 board")}
        data-pulse={movePulse % 2}
        onTouchStart={(event) => {
          touchStart.current = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
          };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 25)
            move(
              Math.abs(dx) > Math.abs(dy)
                ? dx > 0
                  ? "right"
                  : "left"
                : dy > 0
                  ? "down"
                  : "up",
            );
          touchStart.current = null;
        }}
      >
        {state.grid.map((value, index) => (
          <div key={index} role="gridcell" data-value={value}>
            {value || ""}
          </div>
        ))}
      </div>
      {lastGain > 0 ? (
        <p className="game-merge-feedback" role="status">
          +{lastGain}
          <UiCopy pt="na última união" en="in the last merge" />
        </p>
      ) : null}
      {over ? (
        <p role="status">
          <UiCopy pt="Fim de jogo." en="Game over." />
        </p>
      ) : state.grid.some((value) => value >= 2048) ? (
        <p role="status">
          <UiCopy
            pt="Você alcançou 2048! Pode continuar jogando."
            en="You reached 2048! You can keep playing."
          />
        </p>
      ) : null}
      <div className="game-options">
        <button
          type="button"
          onClick={() => {
            setBest(Math.max(best, state.score));
            setState({
              grid: spawn2048(spawn2048(Array(16).fill(0) as number[])),
              score: 0,
            });
            setPrevious(null);
            setLastGain(0);
          }}
        >
          <UiCopy pt="Novo jogo" en="New game" />
        </button>
        <button
          type="button"
          disabled={!previous}
          onClick={() => {
            if (previous) setState(previous);
            setPrevious(null);
          }}
        >
          <UiCopy pt="Desfazer" en="Undo" />
        </button>
      </div>
      <DirectionButtons onMove={move} />
    </section>
  );
}

function DirectionButtons({
  onMove,
}: {
  onMove: (direction: Direction) => void;
}) {
  const tr = useUiText();
  return (
    <div
      className="game-direction-buttons"
      aria-label={tr("Controles de direção", "Direction controls")}
    >
      {(["up", "left", "down", "right"] as Direction[]).map((direction) => (
        <button
          key={direction}
          type="button"
          onClick={() => onMove(direction)}
          aria-label={direction}
        >
          {{ up: "↑", left: "←", down: "↓", right: "→" }[direction]}
        </button>
      ))}
    </div>
  );
}

const snakeWidth = 15;
const delta: Record<Direction, number> = {
  left: -1,
  right: 1,
  up: -snakeWidth,
  down: snakeWidth,
};
type SnakeState = {
  body: number[];
  food: number;
  direction: Direction;
  next: Direction;
  score: number;
  running: boolean;
  over: boolean;
};
function initialSnake(): SnakeState {
  return {
    body: [112, 111, 110],
    food: 70,
    direction: "right",
    next: "right",
    score: 0,
    running: false,
    over: false,
  };
}
function Snake() {
  const tr = useUiText();
  const [state, setState] = useState(initialSnake);
  const [speed, setSpeed] = useState(170);
  const [wrap, setWrap] = useState(false);
  const [best, setBest] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setBest(Number(localStorage.getItem("osh-game-snake-best") || 0));
      } catch {
        /* optional */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (state.score > best) {
      try {
        localStorage.setItem("osh-game-snake-best", String(state.score));
      } catch {
        /* optional */
      }
    }
  }, [state.score, best]);
  function turn(direction: Direction) {
    setState((current) => {
      if (delta[direction] === -delta[current.direction]) return current;
      return { ...current, next: direction, running: !current.over };
    });
  }
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const direction = (
        {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "up",
          ArrowDown: "down",
        } as Record<string, Direction>
      )[event.key];
      if (
        !direction ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      event.preventDefault();
      turn(direction);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (!state.running) return;
    const timer = window.setInterval(
      () =>
        setState((current) => {
          if (!current.running) return current;
          const head = current.body[0];
          const direction = current.next;
          let next = head + delta[direction];
          const wall =
            next < 0 ||
            next >= snakeWidth * snakeWidth ||
            (direction === "left" && head % snakeWidth === 0) ||
            (direction === "right" && head % snakeWidth === snakeWidth - 1);
          if (wrap && wall) {
            const x = head % snakeWidth,
              y = Math.floor(head / snakeWidth);
            next =
              ((y +
                (direction === "down" ? 1 : direction === "up" ? -1 : 0) +
                snakeWidth) %
                snakeWidth) *
                snakeWidth +
              ((x +
                (direction === "right" ? 1 : direction === "left" ? -1 : 0) +
                snakeWidth) %
                snakeWidth);
          }
          const eating = next === current.food;
          if (
            (!wrap && wall) ||
            current.body.slice(0, eating ? undefined : -1).includes(next)
          )
            return { ...current, running: false, over: true };
          const body = [
            next,
            ...current.body.slice(0, eating ? undefined : -1),
          ];
          const free = Array.from(
            { length: snakeWidth * snakeWidth },
            (_, index) => index,
          ).filter((index) => !body.includes(index));
          return {
            ...current,
            body,
            direction,
            food:
              eating && free.length
                ? free[Math.floor(Math.random() * free.length)]
                : current.food,
            score: current.score + (eating ? 1 : 0),
            over: eating && !free.length,
            running: !(eating && !free.length),
          };
        }),
      speed,
    );
    return () => window.clearInterval(timer);
  }, [state.running, speed, wrap]);
  return (
    <section className="local-game game-snake">
      <div className="game-dashboard">
        <span>
          <small>
            <UiCopy pt="PONTOS" en="SCORE" />
          </small>
          <strong>{state.score}</strong>
        </span>
        <span>
          <small>
            <UiCopy pt="RECORDE" en="HIGH SCORE" />
          </small>
          <strong>{Math.max(best, state.score)}</strong>
        </span>
      </div>
      <div className="game-options">
        <label>
          <UiCopy pt="Velocidade" en="Speed" />{" "}
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
          >
            <option value={230}>
              <UiCopy pt="Lenta" en="Slow" />
            </option>
            <option value={170}>
              <UiCopy pt="Normal" en="Normal" />
            </option>
            <option value={110}>
              <UiCopy pt="Rápida" en="Fast" />
            </option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={wrap}
            onChange={(event) => setWrap(event.target.checked)}
          />{" "}
          <UiCopy pt="Atravessar bordas" en="Wrap around edges" />
        </label>
      </div>
      <div
        className="snake-grid"
        role="img"
        aria-label={tr(
          `Snake: ${state.score} pontos`,
          `Snake: ${state.score} points`,
        )}
      >
        {Array.from({ length: snakeWidth * snakeWidth }, (_, index) => (
          <div
            key={index}
            data-kind={
              state.body[0] === index
                ? "head"
                : state.body.includes(index)
                  ? "body"
                  : state.food === index
                    ? "food"
                    : "empty"
            }
          />
        ))}
      </div>
      {state.over ? (
        <p className="game-result" role="status">
          {state.score > best ? "Novo recorde!" : "Fim de jogo."} {state.score}{" "}
          <UiCopy pt="pontos." en="points." />
        </p>
      ) : null}
      <div className="game-options">
        <button
          type="button"
          onClick={() => {
            if (state.over) setBest(Math.max(best, state.score));
            setState((current) =>
              current.over
                ? { ...initialSnake(), running: true }
                : { ...current, running: !current.running },
            );
          }}
        >
          {state.over
            ? tr("Recomeçar", "Restart")
            : state.running
              ? tr("Pausar", "Pause")
              : tr("Iniciar", "Start")}
        </button>
        <button
          type="button"
          onClick={() => {
            setBest(Math.max(best, state.score));
            setState(initialSnake());
          }}
        >
          <UiCopy pt="Novo jogo" en="New game" />
        </button>
      </div>
      <DirectionButtons onMove={turn} />
    </section>
  );
}

type MineState = {
  mines: number[] | null;
  opened: Set<number>;
  flags: Set<number>;
  lost: boolean;
  startedAt: number | null;
};
function Minesweeper() {
  const tr = useUiText();
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "easy",
  );
  const [flagMode, setFlagMode] = useState(false);
  const { width, mineCount } = {
    easy: { width: 8, mineCount: 10 },
    medium: { width: 12, mineCount: 25 },
    hard: { width: 16, mineCount: 40 },
  }[difficulty];
  const [state, setState] = useState<MineState>(() => ({
    mines: null,
    opened: new Set(),
    flags: new Set(),
    lost: false,
    startedAt: null,
  }));
  const [elapsed, setElapsed] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const holdTriggered = useRef(false);
  const lastChord = useRef<number | null>(null);
  const won =
    state.mines !== null && state.opened.size === width * width - mineCount;
  useEffect(() => {
    if (!state.startedAt || state.lost || won) return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - state.startedAt!) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [state.startedAt, state.lost, won]);
  function reset() {
    setState({
      mines: null,
      opened: new Set(),
      flags: new Set(),
      lost: false,
      startedAt: null,
    });
    setElapsed(0);
  }
  function reveal(
    current: MineState,
    targets: number[],
    startedAt: number,
  ): MineState {
    const mines =
      current.mines ?? placeMinesForBoard(targets[0], width, mineCount);
    if (targets.some((cell) => mines.includes(cell)))
      return { ...current, mines, lost: true };
    const opened = new Set(current.opened);
    const queue = [...targets];
    while (queue.length) {
      const cell = queue.shift()!;
      if (opened.has(cell) || current.flags.has(cell) || mines.includes(cell))
        continue;
      opened.add(cell);
      if (
        !mineNeighbors(cell, width).some((neighbor) => mines.includes(neighbor))
      )
        queue.push(...mineNeighbors(cell, width));
    }
    return {
      ...current,
      mines,
      opened,
      startedAt: current.startedAt ?? startedAt,
    };
  }
  function open(index: number, startedAt: number) {
    setState((current) => {
      if (current.lost || current.opened.has(index) || current.flags.has(index))
        return current;
      return reveal(current, [index], startedAt);
    });
  }
  function chord(index: number, startedAt: number) {
    setState((current) => {
      if (current.lost || !current.mines) return current;
      const targets = mineChordTargets(
        index,
        width,
        current.mines,
        current.opened,
        current.flags,
      );
      return targets.length ? reveal(current, targets, startedAt) : current;
    });
  }
  function suppressChordClick(index: number) {
    lastChord.current = index;
    window.setTimeout(() => {
      if (lastChord.current === index) lastChord.current = null;
    }, 350);
  }
  function flag(index: number) {
    setState((current) => {
      if (current.lost || current.opened.has(index)) return current;
      const flags = new Set(current.flags);
      if (flags.has(index)) flags.delete(index);
      else flags.add(index);
      return { ...current, flags };
    });
  }
  return (
    <section className="local-game game-minesweeper">
      <div className="game-dashboard">
        <span>
          <small>
            <UiCopy pt="MINAS RESTANTES" en="MINES LEFT" />
          </small>
          <strong>{mineCount - state.flags.size}</strong>
        </span>
        <span>
          <small>
            <UiCopy pt="TEMPO" en="TIME" />
          </small>
          <strong>{elapsed}s</strong>
        </span>
      </div>
      <div className="game-options">
        <label>
          <UiCopy pt="Dificuldade" en="Difficulty" />{" "}
          <select
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value as typeof difficulty);
              reset();
            }}
          >
            <option value="easy">
              <UiCopy pt="Iniciante 8×8" en="Beginner 8×8" />
            </option>
            <option value="medium">
              <UiCopy pt="Médio 12×12" en="Intermediate 12×12" />
            </option>
            <option value="hard">
              <UiCopy pt="Avançado 16×16" en="Advanced 16×16" />
            </option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={flagMode}
            onChange={(event) => setFlagMode(event.target.checked)}
          />{" "}
          <UiCopy pt="Modo bandeira (toque)" en="Flag mode (touch)" />
        </label>
      </div>
      <p>
        <UiCopy
          pt="Toque para abrir; clique direito marca. Em um número aberto, clique do meio ou esquerdo e direito juntos abrem os vizinhos quando as bandeiras conferem."
          en="Tap to open; right-click marks. On an open number, middle-click or left and right together open its neighbors when the flags match."
        />
      </p>
      <div
        className="mines-grid"
        role="grid"
        aria-label={tr("Campo Minado", "Minesweeper")}
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      >
        {Array.from({ length: width * width }, (_, index) => {
          const visible =
            state.opened.has(index) ||
            (state.lost && state.mines?.includes(index));
          const count = state.mines
            ? mineNeighbors(index, width).filter((neighbor) =>
                state.mines!.includes(neighbor),
              ).length
            : 0;
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={tr(
                `Casa ${index + 1}${state.flags.has(index) ? ", marcada" : ""}`,
                `Cell ${index + 1}${state.flags.has(index) ? ", flagged" : ""}`,
              )}
              disabled={state.lost || won}
              data-open={visible}
              data-number={
                visible && !state.mines?.includes(index) ? count : undefined
              }
              data-mine={visible && !!state.mines?.includes(index)}
              data-flag={state.flags.has(index)}
              onMouseDown={(event) => {
                if (event.button === 1 || event.buttons === 3) {
                  event.preventDefault();
                  suppressChordClick(index);
                  chord(index, Date.now());
                }
              }}
              onAuxClick={(event) => {
                if (event.button === 1) event.preventDefault();
              }}
              onClick={() => {
                if (lastChord.current === index) return;
                if (holdTriggered.current) {
                  holdTriggered.current = false;
                  return;
                }
                if (flagMode) flag(index);
                else open(index, Date.now());
              }}
              onTouchStart={() => {
                holdTriggered.current = false;
                holdTimer.current = window.setTimeout(() => {
                  holdTriggered.current = true;
                  flag(index);
                }, 550);
              }}
              onTouchEnd={() => {
                if (holdTimer.current) window.clearTimeout(holdTimer.current);
              }}
              onTouchMove={() => {
                if (holdTimer.current) window.clearTimeout(holdTimer.current);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                if (lastChord.current !== index) flag(index);
              }}
            >
              {visible
                ? state.mines?.includes(index)
                  ? "✹"
                  : count || ""
                : state.flags.has(index)
                  ? "⚑"
                  : ""}
            </button>
          );
        })}
      </div>
      <p role="status" className="game-result">
        {state.lost
          ? tr("Você encontrou uma mina.", "You hit a mine.")
          : won
            ? tr("Você venceu!", "You won!")
            : tr("Em andamento", "In progress")}
      </p>
      <button type="button" onClick={reset}>
        {tr("Novo jogo", "New game")}
      </button>
    </section>
  );
}
