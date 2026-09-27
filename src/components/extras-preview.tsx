import { UiCopy } from "@/components/ui-language-provider";
type Preview =
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
      {kind === "whiteboard" ? (
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
