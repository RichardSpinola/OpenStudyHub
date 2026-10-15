"use client";
import { useGameWin } from "@/components/game-experience";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUiText } from "@/components/ui-language-provider";
import {
  dropPiece,
  lineBot,
  lineWinner,
  shuffledPairs,
  sudokuCatalog,
  sudokuSolutions,
  type NewGame,
} from "@/lib/extra-games";
function useRecord(userId: number, game: string, score: number, won: boolean) {
  const key = `osh:game:${userId}:${game}`,
    saved = useRef(false);
  const [record, setRecord] = useState<number | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const v = Number(localStorage.getItem(key));
        setRecord(v > 0 ? v : null);
      } catch {}
    };
    load();
  }, [key]);
  useEffect(() => {
    if (!won) {
      saved.current = false;
      return;
    }
    if (saved.current) return;
    saved.current = true;
    try {
      const old = Number(localStorage.getItem(key));
      const best = old > 0 ? Math.min(old, score) : score;
      localStorage.setItem(key, String(best));
      queueMicrotask(() => setRecord(best));
    } catch {}
  }, [key, score, won]);
  return record;
}
export function NewGames({ game, userId }: { game: NewGame; userId: number }) {
  if (game === "memory") return <Memory userId={userId} />;
  if (game === "sudoku") return <Sudoku userId={userId} />;
  return <LineGame connect={game === "connect4"} />;
}
const symbols = [
  "☀",
  "☾",
  "★",
  "♟",
  "♜",
  "♞",
  "♣",
  "♦",
  "♥",
  "♠",
  "♪",
  "⚑",
  "⚓",
  "⚙",
  "☂",
  "✿",
  "✈",
  "☯",
];
function Memory({ userId }: { userId: number }) {
  const tr = useUiText();
  const [pairs, setPairs] = useState(8),
    [cards, setCards] = useState<number[]>([]),
    [open, setOpen] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]),
    [attempts, setAttempts] = useState(0);
  const won = cards.length > 0 && matched.length === pairs;
  const best = useRecord(userId, `memory:${pairs}`, attempts, won);
  useGameWin(won);
  useEffect(() => {
    if (open.length !== 2) return;
    const timer = setTimeout(() => {
      if (cards[open[0]] === cards[open[1]])
        setMatched((m) => [...m, cards[open[0]]]);
      setOpen([]);
    }, 650);
    return () => clearTimeout(timer);
  }, [open, cards]);
  function start() {
    setCards(shuffledPairs(pairs));
    setOpen([]);
    setMatched([]);
    setAttempts(0);
  }
  return (
    <section className="local-game new-game memory-game">
      <div className="game-toolbar">
        <label>
          {tr("Tabuleiro", "Board")}
          <select
            value={pairs}
            onChange={(e) => {
              setPairs(Number(e.target.value));
              setCards([]);
              setMatched([]);
              setOpen([]);
            }}
          >
            <option value={8}>4 × 4</option>
            <option value={12}>4 × 6</option>
            <option value={18}>6 × 6</option>
          </select>
        </label>
        <button onClick={start}>
          {tr(
            cards.length ? "Recomeçar" : "Começar",
            cards.length ? "Restart" : "Start",
          )}
        </button>
      </div>
      <div className="game-dashboard">
        <span>
          {tr("Tentativas", "Attempts")}
          <strong>{attempts}</strong>
        </span>
        <span>
          {tr("Pares", "Pairs")}
          <strong>
            {matched.length} / {pairs}
          </strong>
        </span>
        <span>
          {tr("Melhor", "Best")}
          <strong>{best ?? "—"}</strong>
        </span>
      </div>
      <p role="status">
        {won
          ? tr("Você encontrou todos os pares!", "You found every pair!")
          : cards.length
            ? tr(
                "Abra duas cartas e encontre os pares.",
                "Turn two cards and find matching pairs.",
              )
            : tr(
                "Escolha o tamanho e comece a jogar.",
                "Choose a size and start playing.",
              )}
      </p>
      <div
        className="memory-grid"
        style={{ gridTemplateColumns: `repeat(${pairs === 18 ? 6 : 4},1fr)` }}
      >
        {cards.map((v, i) => (
          <button
            key={i}
            disabled={
              open.length === 2 || matched.includes(v) || open.includes(i)
            }
            aria-label={
              open.includes(i) || matched.includes(v)
                ? `${tr("Carta", "Card")} ${i + 1}: ${symbols[v]}`
                : `${tr("Abrir carta", "Turn card")} ${i + 1}`
            }
            data-open={open.includes(i) || matched.includes(v)}
            onClick={() => {
              setOpen((a) => [...a, i]);
              if (open.length === 1) setAttempts((n) => n + 1);
            }}
          >
            {open.includes(i) || matched.includes(v) ? symbols[v] : "?"}
          </button>
        ))}
      </div>
    </section>
  );
}
function LineGame({ connect }: { connect: boolean }) {
  const tr = useUiText();
  const [board, setBoard] = useState<number[]>(() =>
      Array(connect ? 42 : 9).fill(0),
    ),
    [player, setPlayer] = useState(1),
    [bot, setBot] = useState(true);
  const winner = lineWinner(
      board,
      connect ? 7 : 3,
      connect ? 6 : 3,
      connect ? 4 : 3,
    ),
    draw = !board.includes(0) && !winner;
  useGameWin(!!winner && (!bot || winner === 1));
  function reset() {
    setBoard(Array(connect ? 42 : 9).fill(0));
    setPlayer(1);
  }
  function move(index: number) {
    if (winner || draw || (bot && player === 2)) return;
    const next = connect
      ? dropPiece(board, index, player)
      : !board[index]
        ? board.map((v, i) => (i === index ? player : v))
        : null;
    if (next) {
      setBoard(next);
      setPlayer(3 - player);
    }
  }
  useEffect(() => {
    if (!bot || player !== 2 || winner || draw) return;
    const timer = setTimeout(() => {
      const m = lineBot(board, connect);
      if (m < 0) return;
      setBoard(
        connect
          ? dropPiece(board, m, 2)!
          : board.map((v, i) => (i === m ? 2 : v)),
      );
      setPlayer(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [board, bot, connect, player, winner, draw]);
  return (
    <section className="local-game new-game line-game">
      <div className="game-toolbar">
        <label>
          {tr("Jogar", "Play")}
          <select
            value={bot ? "bot" : "local"}
            onChange={(e) => {
              setBot(e.target.value === "bot");
              reset();
            }}
          >
            <option value="bot">
              {tr("Contra o computador", "Against computer")}
            </option>
            <option value="local">
              {tr("Duas pessoas aqui", "Two people here")}
            </option>
          </select>
        </label>
        <button onClick={reset}>{tr("Novo jogo", "New game")}</button>
      </div>
      <p className="game-result" role="status">
        {winner
          ? bot
            ? winner === 1
              ? tr("Você venceu!", "You won!")
              : tr("O computador venceu.", "Computer won.")
            : `${tr("Jogador", "Player")} ${winner} ${tr("venceu!", "won!")}`
          : draw
            ? tr("Empate.", "Draw.")
            : bot && player === 2
              ? tr("Computador pensando…", "Computer thinking…")
              : `${tr("Vez de", "Turn:")} ${player === 1 ? (connect ? "●" : "X") : connect ? "○" : "O"}`}
      </p>
      {connect ? (
        <div className="connect-controls">
          {Array.from({ length: 7 }, (_, c) => (
            <button
              key={c}
              aria-label={`${tr("Jogar na coluna", "Play column")} ${c + 1}`}
              disabled={!!board[c] || !!winner || draw || (bot && player === 2)}
              onClick={() => move(c)}
            >
              ↓
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={connect ? "connect-grid" : "tic-grid"}
        role="group"
        aria-label={tr("Tabuleiro", "Board")}
      >
        {board.map((v, i) =>
          connect ? (
            <span
              key={i}
              data-player={v}
              aria-label={`${Math.floor(i / 7) + 1}, ${(i % 7) + 1}: ${v || tr("vazio", "empty")}`}
            >
              {v ? "●" : "○"}
            </span>
          ) : (
            <button
              key={i}
              data-player={v}
              aria-label={`${tr("Casa", "Cell")} ${i + 1}: ${v === 1 ? "X" : v === 2 ? "O" : tr("vazia", "empty")}`}
              disabled={!!v || !!winner || draw || (bot && player === 2)}
              onClick={() => move(i)}
            >
              {v === 1 ? "X" : v === 2 ? "O" : ""}
            </button>
          ),
        )}
      </div>
      <p className="game-hint">
        {connect
          ? tr(
              "Escolha uma coluna. Alinhe quatro peças na horizontal, vertical ou diagonal.",
              "Choose a column. Connect four horizontally, vertically or diagonally.",
            )
          : tr(
              "Alinhe três marcas. As primeiras peças são suas.",
              "Connect three marks. You play first.",
            )}
      </p>
    </section>
  );
}
function Sudoku({ userId }: { userId: number }) {
  const tr = useUiText();
  const [difficulty, setDifficulty] =
      useState<keyof typeof sudokuCatalog>("easy"),
    [puzzle, setPuzzle] = useState(() =>
      sudokuCatalog.easy.split("").map(Number),
    ),
    [values, setValues] = useState(puzzle),
    [notes, setNotes] = useState<Record<number, string>>({}),
    [notesMode, setNotesMode] = useState(false),
    [checked, setChecked] = useState(false),
    [moves, setMoves] = useState(0);
  const solution = useMemo(() => sudokuSolutions(puzzle, 1)[0], [puzzle]);
  const won = !!solution && values.every((v, i) => v === solution[i]);
  const best = useRecord(userId, `sudoku:${difficulty}`, moves, won);
  useGameWin(won);
  function start(next = difficulty) {
    const shift = 1 + Math.floor(Math.random() * 8);
    const p = sudokuCatalog[next]
      .split("")
      .map(Number)
      .map((n) => (n ? ((n - 1 + shift) % 9) + 1 : 0));
    setPuzzle(p);
    setValues(p);
    setNotes({});
    setChecked(false);
    setMoves(0);
  }
  return (
    <section className="local-game new-game sudoku-game">
      <div className="game-toolbar">
        <label>
          {tr("Dificuldade", "Difficulty")}
          <select
            value={difficulty}
            onChange={(e) => {
              const d = e.target.value as keyof typeof sudokuCatalog;
              setDifficulty(d);
              start(d);
            }}
          >
            <option value="easy">{tr("Fácil", "Easy")}</option>
            <option value="medium">{tr("Médio", "Medium")}</option>
            <option value="hard">{tr("Difícil", "Hard")}</option>
          </select>
        </label>
        <button onClick={() => start()}>
          {tr("Novo desafio", "New puzzle")}
        </button>
      </div>
      <div className="game-toolbar">
        <button
          aria-pressed={notesMode}
          onClick={() => setNotesMode(!notesMode)}
        >
          {tr("Anotações", "Notes")} {notesMode ? "✓" : ""}
        </button>
        <button onClick={() => setChecked(true)}>
          {tr("Conferir", "Check")}
        </button>
        <span>
          {tr("Melhor:", "Best:")} {best ?? "—"}
        </span>
      </div>
      <p role="status">
        {won
          ? tr("Sudoku completo!", "Sudoku complete!")
          : checked
            ? values.some((v, i) => v && v !== solution?.[i])
              ? tr(
                  "As casas destacadas precisam de revisão.",
                  "Highlighted cells need a review.",
                )
              : tr(
                  "Nenhum erro nas casas preenchidas.",
                  "No errors in filled cells.",
                )
            : tr(
                "Complete cada linha, coluna e bloco com números de 1 a 9.",
                "Fill each row, column and box with numbers 1 to 9.",
              )}
      </p>
      <div className="sudoku-grid" role="group" aria-label="Sudoku">
        {values.map((v, i) => (
          <input
            key={i}
            aria-label={`${tr("Linha", "Row")} ${Math.floor(i / 9) + 1}, ${tr("coluna", "column")} ${(i % 9) + 1}${puzzle[i] ? ": " + puzzle[i] : ""}`}
            aria-invalid={checked && !!v && v !== solution?.[i]}
            data-given={!!puzzle[i]}
            data-notes={notesMode && !puzzle[i]}
            readOnly={!!puzzle[i] || won}
            inputMode="numeric"
            pattern="[1-9]*"
            maxLength={notesMode ? 9 : 1}
            value={puzzle[i] || (notesMode ? (notes[i] ?? "") : v || "")}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^1-9]/g, "");
              if (notesMode)
                setNotes((n) => ({
                  ...n,
                  [i]: [...new Set(digits)].sort().join(""),
                }));
              else {
                setValues((a) =>
                  a.map((old, j) => (j === i ? Number(digits.slice(-1)) : old)),
                );
                setMoves((n) => n + 1);
                setChecked(false);
              }
            }}
          />
        ))}
      </div>
    </section>
  );
}
