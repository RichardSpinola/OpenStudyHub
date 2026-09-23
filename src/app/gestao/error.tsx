"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="v2-console" role="alert">
      <h1>Gestão indisponível</h1>
      <p>Tente novamente ou retorne ao curso.</p>
      <button onClick={reset}>Tentar novamente</button>
    </div>
  );
}
