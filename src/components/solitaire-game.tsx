"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";


import { useEffect, useState } from "react";
import {
  cardColor,
  cardRank,
  cardSuit,
  dealSolitaire,
  drawSolitaire,
  moveSolitaire,
  solitaireWon,
  suitSymbols,
  type DrawCount,
  type Pile,
  type SolitaireState,
  type Target,
} from "@/lib/solitaire";

export function SolitaireGame() {
  const tr = useUiText();
  const [state, setState] = useState(() => dealSolitaire(1, () => 0.5));
  const [history, setHistory] = useState<SolitaireState[]>([]);
  const [selected, setSelected] = useState<Pile | null>(null);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setState(dealSolitaire()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function commit(next: SolitaireState) {
    if (next === state) return;
    setHistory((items) => [...items.slice(-99), state]);
    setState(next);
    setSelected(null);
    setFeedback("");
  }
  function move(source: Pile, target: Target) {
    const next = moveSolitaire(state, source, target);
    if (next === state) setFeedback(tr("Esse movimento não é permitido.", "That move is not allowed."));
    else commit(next);
  }
  function targetClick(target: Target) {
    if (selected) move(selected, target);
  }
  function pick(source: Pile, target: Target) {
    if (selected) {
      const next = moveSolitaire(state, selected, target);
      if (next === state) {
        setSelected(source);
        setFeedback(tr("Selecione um destino válido.", "Select a valid destination."));
      } else commit(next);
      return;
    }
    setSelected(source);
  }
  function drop(event: React.DragEvent, target: Target) {
    event.preventDefault();
    try {
      move(
        JSON.parse(event.dataTransfer.getData("application/osh-card")) as Pile,
        target,
      );
    } catch {
      /* no valid card */
    }
  }
  function card(id: number, source: Pile, target: Target, offset = 0) {
    const rank = cardRank(id);
    const rankText =
      rank === 1
        ? "A"
        : rank === 11
          ? "J"
          : rank === 12
            ? "Q"
            : rank === 13
              ? "K"
              : String(rank);
    const suit = suitSymbols[cardSuit(id)];
    return (
      <button
        key={id}
        type="button"
        draggable
        onDragStart={(event) =>
          event.dataTransfer.setData(
            "application/osh-card",
            JSON.stringify(source),
          )
        }
        onClick={(event) => {
          event.stopPropagation();
          pick(source, target);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          const foundation = moveSolitaire(state, source, {
            kind: "foundation",
            index: cardSuit(id),
          });
          if (foundation === state)
            setFeedback(tr("Esta carta ainda não pode ir para a fundação.", "This card cannot go to the foundation yet."));
          else commit(foundation);
        }}
        className="solitaire-card"
        data-color={cardColor(id)}
        data-selected={JSON.stringify(selected) === JSON.stringify(source)}
        style={{ top: `calc(${offset} * var(--card-step, 1.7rem))` }}
        aria-label={`${rankText} de ${["paus", "copas", "ouros", "espadas"][cardSuit(id)]}`}
      >
        <span className="solitaire-corner">
          {rankText}
          <small>{suit}</small>
        </span>
        <span className="solitaire-center">{suit}</span>
        <span className="solitaire-corner solitaire-corner-bottom">
          {rankText}
          <small>{suit}</small>
        </span>
      </button>
    );
  }
  return (
    <section className="local-game solitaire-game">
      <div className="game-dashboard">
        <span>{tr("Movimentos", "Moves")}: {state.moves}</span>
        <span>
          {solitaireWon(state)
            ? tr("Você venceu!", "You won!")
            : tr("Organize as quatro sequências por naipe.", "Build all four sequences by suit.")}
        </span>
      </div>
      <div className="game-options">
        <label>
          {tr("Compra", "Draw")}{" "}
          <select
            value={state.drawCount}
            onChange={(event) => {
              const count = Number(event.target.value) as DrawCount;
              setState(dealSolitaire(count));
              setHistory([]);
              setSelected(null);
            }}
          >
            <option value={1}><UiCopy pt="1 carta" en="1 card" /></option>
            <option value={3}><UiCopy pt="3 cartas" en="3 cards" /></option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setState(dealSolitaire(state.drawCount));
            setHistory([]);
            setSelected(null);
          }}
        ><UiCopy pt="Novo jogo" en="New game" />
        </button>
        <button
          type="button"
          disabled={!history.length}
          onClick={() => {
            setState(history.at(-1)!);
            setHistory(history.slice(0, -1));
            setSelected(null);
          }}
        ><UiCopy pt="Desfazer" en="Undo" />
        </button>
      </div>
      <p className="game-hint"><UiCopy pt="Toque em uma carta e no destino; arraste ou dê dois cliques para enviá-la à fundação." en="Tap a card and its destination; drag or double-click to send it to the foundation." /></p>
      {feedback ? (
        <p className="game-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <div className="solitaire-top">
        <button
          type="button"
          className="solitaire-card solitaire-stock"
          onClick={() => commit(drawSolitaire(state))}
          aria-label={
            state.stock.length
              ? `Comprar cartas: ${state.stock.length} restantes`
              : "Recolher descarte"
          }
        >
          {state.stock.length ? "OSH" : "↻"}
        </button>
        <div
          className="solitaire-pile"
          onDragOver={(event) => event.preventDefault()}
        >
          {state.waste.length ? (
            card(
              state.waste.at(-1)!,
              { kind: "waste" },
              { kind: "tableau", index: -1 },
            )
          ) : (
            <span><UiCopy pt="Descarte" en="Waste pile" /></span>
          )}
        </div>
        <div className="solitaire-foundations">
          {state.foundations.map((pile, index) => (
            <div
              key={index}
              className="solitaire-pile"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => drop(event, { kind: "foundation", index })}
              onClick={() => targetClick({ kind: "foundation", index })}
            >
              {pile.length ? (
                card(
                  pile.at(-1)!,
                  { kind: "foundation", index },
                  { kind: "foundation", index },
                )
              ) : (
                <span>{suitSymbols[index]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="solitaire-tableau">
        {state.tableau.map((pile, index) => (
          <div
            key={index}
            className="solitaire-column"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, { kind: "tableau", index })}
            onClick={() => targetClick({ kind: "tableau", index })}
          >
            {!pile.length ? <span className="solitaire-empty">K</span> : null}
            {pile.map((item, from) =>
              item.faceUp ? (
                card(
                  item.id,
                  { kind: "tableau", index, from },
                  { kind: "tableau", index },
                  from,
                )
              ) : (
                <span
                  key={item.id}
                  className="solitaire-card solitaire-back"
                  style={{ top: `calc(${from} * var(--card-step, 1.7rem))` }}
                >
                  OSH
                </span>
              ),
            )}
          </div>
        ))}
      </div>
      <p className="game-hint"><UiCopy pt="Ás → Rei nas fundações. Nas colunas, cores alternadas em ordem decrescente." en="Ace → King in foundations. In columns, alternate colors in descending order." /></p>
    </section>
  );
}
