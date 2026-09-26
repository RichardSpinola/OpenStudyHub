"use client";
import { UiCopy } from "@/components/ui-language-provider";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="v2-console" role="alert">
      <h1>
        <UiCopy pt="Gestão indisponível" en="Management unavailable" />
      </h1>
      <p>
        <UiCopy
          pt="Tente novamente ou retorne ao curso."
          en="Try again or return to the course."
        />
      </p>
      <button onClick={reset}>
        <UiCopy pt="Tentar novamente" en="Try again" />
      </button>
    </div>
  );
}
