"use client";
import { UiCopy } from "@/components/ui-language-provider";

import { useEffect } from "react";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route failed", error.name);
  }, [error]);
  return (
    <div className="v2-console" role="alert">
      <h1>
        <UiCopy
          pt="Não foi possível abrir esta área"
          en="This area could not be opened"
        />
      </h1>
      <p>
        <UiCopy
          pt="Confira se o ambiente V2 está configurado e tente novamente."
          en="Check that V2 is configured and try again."
        />
      </p>
      <button onClick={reset}>
        <UiCopy pt="Tentar novamente" en="Try again" />
      </button>
    </div>
  );
}
