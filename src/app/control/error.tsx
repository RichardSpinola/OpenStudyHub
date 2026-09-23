"use client";
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
      <h1>Não foi possível abrir esta área</h1>
      <p>Confira se o ambiente V2 está configurado e tente novamente.</p>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  );
}
