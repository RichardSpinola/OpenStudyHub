import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { getExtrasFlags, extraAccessible } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { ExtrasPreview } from "@/components/extras-preview";

export default function ExtrasPage() {
  const flags = withV2Db(getExtrasFlags);
  return (
    <>
      <header className="extras-header">
        <span className="page-kicker"><UiCopy pt="OPCIONAL" en="OPTIONAL" /></span>
        <h1>Extras</h1>
        <p><UiCopy pt="Um espaço para desenhar e jogar, fora da rotina acadêmica." en="A place to draw and play, away from academic work." /></p>
      </header>
      <div className="extras-cards extras-feature-grid">
        {extraAccessible(flags, "whiteboard") ? (
          <Link href="/extras/whiteboard" className="extras-feature-card">
            <ExtrasPreview kind="whiteboard" />
            <span className="extras-card-copy">
              <strong><UiCopy pt="Quadro Branco" en="Whiteboard" /></strong>
              <span><UiCopy pt="Um espaço compartilhado para desenhar e organizar ideias em tempo real." en="A shared space to draw and organize ideas in real time." /></span>
              <em><UiCopy pt="Abrir quadro →" en="Open whiteboard →" /></em>
            </span>
          </Link>
        ) : null}
        {extraAccessible(flags, "games") ? (
          <Link href="/extras/games" className="extras-feature-card">
            <ExtrasPreview kind="games" />
            <span className="extras-card-copy">
              <strong><UiCopy pt="Joguinhos" en="Minigames" /></strong>
              <span><UiCopy pt="Cinco jogos para uma pausa, incluindo partidas privadas de Dominó." en="Five games for a break, including private Domino matches." /></span>
              <em><UiCopy pt="Escolher jogo →" en="Choose game →" /></em>
            </span>
          </Link>
        ) : null}
      </div>
    </>
  );
}
