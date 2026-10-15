"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUiText } from "@/components/ui-language-provider";
import { createImportedNoteAction } from "@/app/notes/actions";
export function NoteImport() {
  const router = useRouter();
  const tr = useUiText(),
    input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="note-import">
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy
          ? tr("Importando…", "Importing…")
          : tr("Importar página", "Import page")}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".md,.markdown,.txt,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError("");
          if (file.size > 2_100_000) {
            setError(
              tr(
                "Use Markdown de até 100 KB ou um rascunho do Hub de até 2 MB.",
                "Use Markdown up to 100 KB or a Hub draft up to 2 MB.",
              ),
            );
            e.target.value = "";
            return;
          }
          setBusy(true);
          try {
            const content = await file.text();
            const data = new FormData();
            data.set("filename", file.name);
            data.set("content", content);
            const result = await createImportedNoteAction(data);
            if (result.error) {
              setError(result.error);
              setBusy(false);
            } else if (result.id) router.push(`/notes/${result.id}`);
          } catch {
            setError(
              tr(
                "Não foi possível importar. Confira o arquivo e tente novamente.",
                "Could not import. Check the file and retry.",
              ),
            );
            setBusy(false);
          }
          if (input.current) input.current.value = "";
        }}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
