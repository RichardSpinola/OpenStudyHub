"use client";
import { UiCopy } from "@/components/ui-language-provider";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <main>
          <h1>
            <UiCopy
              pt="OpenStudyHub indisponível"
              en="OpenStudyHub unavailable"
            />
          </h1>
          <p>
            <UiCopy
              pt="Ocorreu um erro inesperado."
              en="An unexpected error occurred."
            />
          </p>
          <button type="button" onClick={reset}>
            <UiCopy pt="Tentar novamente" en="Try again" />
          </button>
        </main>
      </body>
    </html>
  );
}
