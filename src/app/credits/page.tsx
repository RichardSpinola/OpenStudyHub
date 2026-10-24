import Link from "next/link";
import { UiCopy } from "@/components/ui-language-provider";
export default function CreditsPage() {
  return (
    <main className="workflow-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">OpenStudyHub</p>
          <h1>
            <UiCopy pt="Créditos" en="Credits" />
          </h1>
        </div>
        <Link href="/settings?section=about">
          ← <UiCopy pt="Configurações" en="Settings" />
        </Link>
      </header>
      <section className="panel">
        <h2>
          <UiCopy pt="Editor de Notas" en="Notes editor" />
        </h2>
        <p>
          <a
            href="https://github.com/TypeCellOS/BlockNote/tree/v0.56.0/packages"
            target="_blank"
            rel="noreferrer"
          >
            BlockNote 0.56.0 · TypeCell / contributors
          </a>{" "}
          · <a href="/licenses/blocknote-MPL-2.0.txt">MPL-2.0</a>
        </p>
        <p>
          <a href="https://github.com/yjs/yjs" target="_blank" rel="noreferrer">
            Yjs 13.6.33 · Kevin Jahns / contributors
          </a>{" "}
          · <a href="/licenses/yjs-MIT.txt">MIT</a>
        </p>
        <ul>
          {["y-prosemirror", "y-protocols", "y-indexeddb"].map((name) => (
            <li key={name}>
              <a
                href={`https://github.com/yjs/${name}`}
                target="_blank"
                rel="noreferrer"
              >
                {name}
              </a>{" "}
              · <a href={`/licenses/${name}-MIT.txt`}>MIT</a>
            </li>
          ))}
        </ul>
        <p>
          <UiCopy
            pt="A organização, o armazenamento e as permissões das Notas são implementados pelo OpenStudyHub. Não foi utilizado código do AppFlowy ou do Notion."
            en="Notes organization, storage and permissions are implemented by OpenStudyHub. AppFlowy and Notion code was not used."
          />
        </p>
      </section>
      <section className="panel">
        <h2>
          <UiCopy pt="Quadro Branco" en="Whiteboard" />
        </h2>
        <p>
          <a
            href="https://github.com/excalidraw/excalidraw/blob/v0.18.1/LICENSE"
            target="_blank"
            rel="noreferrer"
          >
            Excalidraw 0.18.1 · MIT
          </a>
        </p>
      </section>
      <section className="panel">
        <h2>
          <UiCopy
            pt="Segurança e assistente de IA"
            en="Security and AI assistant"
          />
        </h2>
        <ul>
          <li>
            node-qrcode · <a href="/licenses/qrcode-MIT.txt">MIT</a>
          </li>
          <li>
            PDF.js · Mozilla Foundation ·{" "}
            <a href="/licenses/pdfjs-Apache-2.0.txt">Apache-2.0</a>
          </li>
          <li>
            Mammoth · Michael Williamson ·{" "}
            <a href="/licenses/mammoth-BSD-2-Clause.txt">BSD-2-Clause</a>
          </li>
        </ul>
        <p>
          <UiCopy
            pt="Nenhum modelo de IA é distribuído com o Hub."
            en="No AI model is distributed with the Hub."
          />
        </p>
      </section>
    </main>
  );
}
