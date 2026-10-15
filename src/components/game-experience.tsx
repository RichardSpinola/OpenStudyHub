"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUiText } from "@/components/ui-language-provider";
const WinContext = createContext(() => {});
export function useGameWin(won: boolean) {
  const celebrate = useContext(WinContext),
    previous = useRef(false);
  useEffect(() => {
    if (won && !previous.current) celebrate();
    previous.current = won;
  }, [won, celebrate]);
}
export function GameExperience({
  userId,
  game,
  children,
}: {
  userId: number;
  game: string;
  children: ReactNode;
}) {
  const tr = useUiText(),
    [sound, setSound] = useState(false),
    [celebrating, setCelebrating] = useState(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    audio = useRef<AudioContext | null>(null);
  const celebrate = useCallback(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCelebrating(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCelebrating(false), 1400);
    }
    if (sound) {
      try {
        const ctx = audio.current ?? new AudioContext();
        audio.current = ctx;
        void ctx.resume();
        const wave = ctx.createOscillator(),
          gain = ctx.createGain();
        wave.connect(gain);
        gain.connect(ctx.destination);
        wave.frequency.setValueAtTime(660, ctx.currentTime);
        wave.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.035, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        wave.start();
        wave.stop(ctx.currentTime + 0.4);
      } catch {}
    }
  }, [sound]);
  useEffect(() => {
    const restore = setTimeout(() => {
      try {
        setSound(localStorage.getItem(`osh:game-sound:${userId}`) === "1");
      } catch {}
    }, 0);
    return () => {
      clearTimeout(restore);
      if (timer.current) clearTimeout(timer.current);
      void audio.current?.close();
    };
  }, [userId]);
  const instructions: Record<string, [string, string]> = {
    snake: [
      "Use as setas ou os botões de direção. Colete alimento e evite paredes e seu corpo. Iniciar e Pausar controlam a partida.",
      "Use arrow keys or direction buttons. Collect food and avoid walls and your body. Start and Pause control the game.",
    ],
    "2048": [
      "Use as setas ou deslize no tabuleiro. Números iguais se unem; alcance 2048. Desfazer permite voltar a última jogada.",
      "Use arrows or swipe the board. Equal numbers merge; reach 2048. Undo returns to the last move.",
    ],
    minesweeper: [
      "Toque para abrir. Ative Modo bandeira para marcar uma casa ou mantenha o toque. Números indicam minas vizinhas. Um número aberto permite abrir os vizinhos se as bandeiras conferem. Tabuleiros grandes podem ser deslizados na horizontal.",
      "Tap to reveal. Use Flag mode or hold to mark a cell. Numbers count nearby mines. Open adjacent cells from a revealed number when flags match. Large boards can scroll horizontally.",
    ],
    solitaire: [
      "Selecione uma carta e depois o destino. Alterne as cores em ordem decrescente nas colunas; organize cada naipe do Ás ao Rei nas fundações. Dois cliques enviam uma carta possível à fundação. Desfazer volta uma jogada.",
      "Select a card and then its destination. Alternate colors in descending order in columns; build suits from Ace to King in foundations. Double-click sends an eligible card to a foundation. Undo returns a move.",
    ],
    domino: [
      "Crie uma partida e envie o convite a outra pessoa da instância. Selecione uma peça e escolha a ponta do tabuleiro. Quando não houver jogada, compre ou passe conforme os controles disponíveis.",
      "Create a match and send the invite to another instance member. Select a tile and choose a board end. Draw or pass when no move is available.",
    ],
    memory: [
      "Escolha o tabuleiro e clique em Começar. Abra duas cartas por vez. Os pares ficam abertos; encontre todos usando menos tentativas.",
      "Choose a board and Start. Turn two cards at a time. Matching pairs stay open; find them all with fewer attempts.",
    ],
    sudoku: [
      "Complete cada linha, coluna e bloco com 1 a 9 sem repetir. As pistas são fixas. Anotações guarda candidatos nas casas vazias; Conferir destaca erros. Novo desafio cria uma variação do catálogo.",
      "Fill each row, column and box with 1 to 9 without repeats. Clues are fixed. Notes stores candidates in empty cells; Check highlights mistakes. New puzzle varies the catalog.",
    ],
    connect4: [
      "Escolha uma coluna para soltar sua peça. Alinhe quatro na horizontal, vertical ou diagonal. Você pode jogar contra o computador ou outra pessoa no mesmo aparelho.",
      "Choose a column to drop a piece. Connect four horizontally, vertically or diagonally. Play against the computer or someone on the same device.",
    ],
    tictactoe: [
      "Alinhe três marcas na horizontal, vertical ou diagonal. Contra o computador, você começa com X. Duas pessoas podem alternar no mesmo aparelho.",
      "Connect three marks horizontally, vertically or diagonally. Against the computer, you start with X. Two people can take turns on the same device.",
    ],
  };
  return (
    <WinContext.Provider value={celebrate}>
      <div className="game-experience" data-game={game}>
        <div className="game-utility-bar">
          <details>
            <summary>{tr("Como jogar", "How to play")}</summary>
            <p>{tr(...(instructions[game] ?? instructions.snake))}</p>
          </details>
          <label>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                try {
                  localStorage.setItem(
                    `osh:game-sound:${userId}`,
                    e.target.checked ? "1" : "0",
                  );
                } catch {}
              }}
            />
            {tr("Som ao vencer", "Victory sound")}
          </label>
        </div>
        {celebrating ? (
          <div className="game-confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${i * 5.5}%`,
                  animationDelay: `${(i % 4) * 0.07}s`,
                  background: i % 2 ? "var(--accent)" : "var(--white)",
                }}
              />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </WinContext.Provider>
  );
}
