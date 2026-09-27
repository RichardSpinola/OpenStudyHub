"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useCallback, useEffect, useState } from "react";
import { sendRealtime } from "@/components/realtime-bridge";
import { tileById, type DominoAction, type PlayedTile } from "@/lib/domino";

type Match = {
  id: string;
  seat: 0 | 1;
  names: string[];
  version: number;
  inviteCode: string | null;
  hand: number[];
  opponentCount: number;
  stockCount: number;
  chain: PlayedTile[];
  turn: 0 | 1;
  scores: [number, number];
  round: number;
  phase: "waiting" | "playing" | "finished";
  openingTile: number | null;
  lastRound: { winner: 0 | 1 | null; points: number; reason: string } | null;
  winner: 0 | 1 | null;
  canPlay: number[];
};
type Summary = {
  id: string;
  phase: string;
  opponent: string;
  updatedAt: number;
};
async function request(body: unknown) {
  const response = await fetch("/api/extras/domino", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Não foi possível atualizar a partida.");
  return data;
}
const pips: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
function PipFace({ value }: { value: number }) {
  return (
    <span className="domino-face" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} data-on={pips[value].includes(index)} />
      ))}
    </span>
  );
}
function Tile({
  id,
  left,
  right,
}: {
  id?: number;
  left?: number;
  right?: number;
}) {
  const tr = useUiText();
  const tile = id === undefined ? null : tileById(id);
  const a = left ?? tile?.a ?? 0;
  const b = right ?? tile?.b ?? 0;
  return (
    <span
      className="domino-tile"
      data-double={a === b}
      aria-label={tr(`${a} e ${b}`, `${a} and ${b}`)}
    >
      <PipFace value={a} />
      <b aria-hidden="true" />
      <PipFace value={b} />
    </span>
  );
}
export function DominoGame({
  initialInvite,
  initialMatch,
}: {
  initialInvite?: string;
  initialMatch?: string;
}) {
  const tr = useUiText();
  const [id, setId] = useState(initialMatch || "");
  const [invite, setInvite] = useState(initialInvite || "");
  const [match, setMatch] = useState<Match | null>(null);
  const [list, setList] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (matchId: string) => {
      const response = await fetch(
        `/api/extras/domino?id=${encodeURIComponent(matchId)}`,
        { cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(tr("Partida indisponível.", "Match unavailable."));
      setMatch((await response.json()) as Match);
    },
    [tr],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (id) void load(id).catch((cause) => setError(cause.message));
      else
        void fetch("/api/extras/domino", { cache: "no-store" })
          .then((response) => response.json())
          .then((data: Summary[]) => setList(data))
          .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id, load]);
  useEffect(() => {
    if (!id) return;
    function onRealtime(event: Event) {
      const detail = (event as CustomEvent<{ type: string; matchId?: string }>)
        .detail;
      if (detail.type === "ready") {
        sendRealtime({ type: "domino-subscribe", matchId: id });
        void load(id).catch(() => undefined);
      }
      if (detail.type === "domino-refresh" && detail.matchId === id)
        void load(id).catch(() => undefined);
    }
    sendRealtime({ type: "domino-subscribe", matchId: id });
    window.addEventListener("openstudyhub:realtime", onRealtime);
    const interval = window.setInterval(
      () => void load(id).catch(() => undefined),
      8000,
    );
    return () => {
      sendRealtime({ type: "domino-unsubscribe", matchId: id });
      window.removeEventListener("openstudyhub:realtime", onRealtime);
      window.clearInterval(interval);
    };
  }, [id, load]);
  function navigate(next: string) {
    setId(next);
    setMatch(null);
    setSelected(null);
    history.replaceState(
      null,
      "",
      `/extras/games/domino?match=${encodeURIComponent(next)}`,
    );
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await request({ type: "create" });
      navigate(result.id);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    setBusy(true);
    setError("");
    try {
      const result = await request({
        type: "join",
        code: invite.trim().toLowerCase(),
      });
      navigate(result.id);
      sendRealtime({ type: "domino-refresh", matchId: result.id });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(action: DominoAction) {
    if (!match) return;
    setBusy(true);
    setError("");
    try {
      const updated = (await request({
        type: "action",
        id: match.id,
        version: match.version,
        action,
      })) as Match;
      setMatch(updated);
      setSelected(null);
      sendRealtime({ type: "domino-refresh", matchId: match.id });
    } catch (cause) {
      setError((cause as Error).message);
      await load(match.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  const myTurn = match?.phase === "playing" && match.turn === match.seat;
  return (
    <section className="local-game domino-game">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!id ? (
        <>
          <p>
            <UiCopy
              pt="Partida privada para duas pessoas. Compartilhe o convite com outro usuário da instância."
              en="A private match for two. Share the invite with another instance user."
            />
          </p>
          <button type="button" disabled={busy} onClick={() => void create()}>
            <UiCopy pt="Criar partida" en="Create match" />
          </button>
          <label className="domino-invite-entry">
            <UiCopy pt="Código do convite" en="Invite code" />
            <input
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder={tr(
                "Cole o código recebido",
                "Paste the received code",
              )}
            />
          </label>
          <button
            type="button"
            disabled={busy || !/^[a-f0-9]{32}$/i.test(invite)}
            onClick={() => void join()}
          >
            <UiCopy pt="Entrar na partida" en="Join match" />
          </button>
          {list.length ? (
            <div className="domino-match-list">
              <h2>
                <UiCopy pt="Suas partidas" en="Your matches" />
              </h2>
              {list.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => navigate(item.id)}
                >
                  {item.opponent} ·{" "}
                  {item.phase === "playing"
                    ? "em andamento"
                    : item.phase === "waiting"
                      ? "aguardando"
                      : "encerrada"}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : !match ? (
        <p role="status">
          <UiCopy pt="Carregando partida…" en="Loading match…" />
        </p>
      ) : (
        <>
          {match.phase === "waiting" && match.inviteCode ? (
            <div className="domino-waiting">
              <p>
                <UiCopy
                  pt="Aguardando segundo jogador."
                  en="Waiting for a second player."
                />
              </p>
              <label>
                <UiCopy pt="Convite" en="Invitation" />
                <input
                  readOnly
                  value={`${location.origin}/extras/games/domino?invite=${match.inviteCode}`}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    `${location.origin}/extras/games/domino?invite=${match.inviteCode}`,
                  )
                }
              >
                <UiCopy pt="Copiar convite" en="Copy invite" />
              </button>
            </div>
          ) : null}
          <div className="game-dashboard">
            <span>
              <small>
                <UiCopy pt="PLACAR" en="SCORE" />
              </small>
              <strong>
                {match.names[0]} {match.scores[0]} × {match.scores[1]}{" "}
                {match.names[1]}
              </strong>
            </span>
            <span>
              <small>
                <UiCopy pt="PARTIDA" en="MATCH" />
              </small>
              <strong>
                {match.phase === "finished"
                  ? `Venceu: ${match.names[match.winner ?? 0]}`
                  : `Rodada ${match.round} · ${match.phase === "playing" ? `vez de ${match.names[match.turn]}` : "aguardando"}`}
              </strong>
            </span>
          </div>
          {match.lastRound ? (
            <p role="status">
              <UiCopy pt="Última rodada:" en="Last round:" />{" "}
              {match.lastRound.winner === null
                ? "empate"
                : `${match.names[match.lastRound.winner]} +${match.lastRound.points} pontos`}
              .
            </p>
          ) : null}
          <div className="domino-table">
            <div className="domino-opponent">
              <strong>{match.names[match.seat === 0 ? 1 : 0]}</strong>
              <span>
                {Array.from(
                  { length: Math.min(match.opponentCount, 14) },
                  (_, index) => (
                    <i key={index} className="domino-back" />
                  ),
                )}
                <small>
                  {match.opponentCount}
                  <UiCopy pt="peças" en="tiles" />
                </small>
              </span>
            </div>
            <div
              className="domino-chain"
              aria-label={tr("Peças na mesa", "Tiles on the table")}
            >
              {match.chain.length ? (
                match.chain.map((tile, index) => (
                  <Tile
                    key={`${index}-${tile.id}`}
                    left={tile.left}
                    right={tile.right}
                  />
                ))
              ) : (
                <span>
                  {match.openingTile === null
                    ? tr("Mesa vazia", "Empty table")
                    : tr(
                        "Comece com a maior dupla",
                        "Start with the highest double",
                      )}
                </span>
              )}
            </div>
            <div className="domino-stock">
              <span className="domino-back" />
              <UiCopy pt="Monte ·" en="Stock ·" /> {match.stockCount}
              <UiCopy pt="peças" en="tiles" />
            </div>
          </div>
          <h3 className="domino-hand-title">
            <UiCopy pt="Sua mão" en="Your hand" />
            <small>
              {match.hand.length}
              <UiCopy pt="peças" en="tiles" />
            </small>
          </h3>
          <div
            className="domino-hand"
            aria-label={tr("Suas peças", "Your tiles")}
          >
            {match.hand.map((tile) => (
              <button
                key={tile}
                type="button"
                className="domino-hand-tile"
                data-selected={selected === tile}
                data-playable={match.canPlay.includes(tile)}
                disabled={!myTurn || busy}
                onClick={() => setSelected(tile)}
              >
                <Tile id={tile} />
              </button>
            ))}
          </div>
          <div className="game-options">
            <button
              type="button"
              disabled={!myTurn || selected === null || busy}
              onClick={() =>
                void act({ type: "play", tile: selected!, side: "left" })
              }
            >
              <UiCopy pt="Jogar à esquerda" en="Play on left" />
            </button>
            <button
              type="button"
              disabled={!myTurn || selected === null || busy}
              onClick={() =>
                void act({ type: "play", tile: selected!, side: "right" })
              }
            >
              <UiCopy pt="Jogar à direita" en="Play on right" />
            </button>
            <button
              type="button"
              disabled={
                !myTurn || !!match.canPlay.length || !match.stockCount || busy
              }
              onClick={() => void act({ type: "draw" })}
            >
              <UiCopy pt="Comprar" en="Draw" />
            </button>
            <button
              type="button"
              disabled={
                !myTurn || !!match.canPlay.length || !!match.stockCount || busy
              }
              onClick={() => void act({ type: "pass" })}
            >
              <UiCopy pt="Passar" en="Pass" />
            </button>
            <button
              type="button"
              disabled={match.phase !== "playing" || busy}
              onClick={() => {
                if (confirm("Abandonar a partida?"))
                  void act({ type: "resign" });
              }}
            >
              <UiCopy pt="Abandonar" en="Forfeit" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setId("");
              setMatch(null);
              history.replaceState(null, "", "/extras/games/domino");
            }}
          >
            <UiCopy pt="Voltar às partidas" en="Back to matches" />
          </button>
          {match.phase === "finished" ? (
            <button type="button" disabled={busy} onClick={() => void create()}>
              <UiCopy pt="Nova partida" en="New match" />
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
