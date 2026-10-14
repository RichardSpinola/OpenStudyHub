"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useUiText } from "./ui-language-provider";
export function DocumentContextChooser({
  offerings,
  sources,
  offeringId,
  source,
}: {
  offerings: Array<{ id: number; name: string }>;
  sources: Array<{ value: string; name: string }>;
  offeringId: number | null;
  source: string;
}) {
  const tr = useUiText(),
    router = useRouter(),
    params = useSearchParams(),
    [pending, startTransition] = useTransition();
  function change(key: "offeringId" | "source", value: string) {
    const query = new URLSearchParams(params.toString());
    query.set("type", "documents");
    query.set("view", "generate");
    query.delete("status");
    if (key === "offeringId") {
      query.set(key, value);
      query.delete("activityId");
    } else {
      query.delete("starterKey");
      query.delete("templateId");
      const [kind, id] = value.split(":");
      if (kind === "starter") query.set("starterKey", id);
      else query.set("templateId", id);
    }
    startTransition(() =>
      router.replace(`/library?${query}`, { scroll: false }),
    );
  }
  return (
    <div className="document-source-chooser" aria-busy={pending}>
      <label>
        {tr("Modelo inicial", "Starting template")}
        <select
          value={source}
          disabled={pending}
          onChange={(e) => change("source", e.target.value)}
        >
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tr("Disciplina", "Subject")}
        <select
          value={offeringId ?? ""}
          disabled={pending}
          onChange={(e) => change("offeringId", e.target.value)}
        >
          <option value="">
            {tr("Escolha uma disciplina", "Choose a subject")}
          </option>
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {pending ? (
        <small role="status">
          {tr("Atualizando contexto…", "Updating context…")}
        </small>
      ) : null}
    </div>
  );
}
