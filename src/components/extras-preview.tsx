import { UiCopy } from "@/components/ui-language-provider";
type Preview =
  | "ai"
  | "memory"
  | "sudoku"
  | "connect4"
  | "tictactoe"
  | "focus"
  | "flashcards"
  | "whiteboard"
  | "games"
  | "snake"
  | "2048"
  | "minesweeper"
  | "solitaire"
  | "domino";

export function ExtrasPreview({ kind }: { kind: Preview }) {
  return (
    <span
      className={`extras-preview extras-preview--${kind}`}
      aria-hidden="true"
    >
      {kind === "memory" ? (
        <span className="preview-memory">
          <i data-face="up">★</i>
          <i />
          <i />
          <i data-face="up">★</i>
        </span>
      ) : kind === "sudoku" ? (
        <span className="preview-sudoku">
          {["5", "", "3", "", "7", "", "9", "", "1"].map((value, index) => (
            <i key={index} data-ink={index === 4 ? "pencil" : undefined}>
              {value}
            </i>
          ))}
        </span>
      ) : kind === "connect4" ? (
        <span className="preview-connect4">
          {[..."-----y---ry-yrrr"].map((disc, index) => (
            <i key={index} data-disc={disc === "-" ? undefined : disc} />
          ))}
        </span>
      ) : kind === "tictactoe" ? (
        <span className="preview-tictactoe">
          {["X", "O", "", "", "X", "", "O", "", "X"].map((mark, index) => (
            <i key={index} data-mark={mark || undefined}>
              {mark}
            </i>
          ))}
        </span>
      ) : kind === "ai" ? (
        <span className="preview-ai">
          <i className="preview-ai-question">
            <UiCopy pt="O que é mitose?" en="What is mitosis?" />
          </i>
          <i className="preview-ai-answer">
            <b />
            <b />
            <b />
            <small>[S1]</small>
          </i>
        </span>
      ) : kind === "focus" ? (
        <span className="preview-focus">25:00</span>
      ) : kind === "flashcards" ? (
        <span className="preview-flashcards">
          <i />
          <i />
          <i>?</i>
        </span>
      ) : kind === "whiteboard" ? (
        <span className="preview-board">
          <i className="preview-board-line" />
          <i className="preview-board-circle" />
          <i className="preview-board-note">
            <UiCopy pt="ideias" en="ideas" />
          </i>
          <i className="preview-board-cursor">↖</i>
        </span>
      ) : kind === "games" ? (
        <span className="preview-games">
          <i>2</i>
          <i>4</i>
          <i>8</i>
          <b>♠</b>
          <b>⚑</b>
          <b>●</b>
        </span>
      ) : kind === "snake" ? (
        <span className="preview-snake">
          <i />
          <i />
          <i />
          <i />
          <i />
          <b />
        </span>
      ) : kind === "2048" ? (
        <span className="preview-2048">
          <i>2</i>
          <i>4</i>
          <i>8</i>
          <i>16</i>
        </span>
      ) : kind === "minesweeper" ? (
        <span className="preview-mines">
          <i>1</i>
          <i>2</i>
          <i>⚑</i>
          <i>1</i>
          <i>●</i>
          <i>2</i>
        </span>
      ) : kind === "solitaire" ? (
        <span className="preview-cards">
          <i>
            ♠<small>A</small>
          </i>
          <i>
            ♥<small>Q</small>
          </i>
          <i>
            ♦<small>10</small>
          </i>
        </span>
      ) : (
        <span className="preview-domino">
          <i>
            <b>••</b>
            <b>•••</b>
          </i>
          <i>
            <b>•••</b>
            <b>•</b>
          </i>
          <i>
            <b>•</b>
            <b>••</b>
          </i>
        </span>
      )}
    </span>
  );
}
