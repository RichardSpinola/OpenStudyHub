"use client";

import { useRef, useState } from "react";

import {
  cancelProjectUploadAction,
  confirmProjectUploadAction,
} from "@/app/projects/actions";

type Preview = {
  token: string;
  files: number;
  diff: {
    added: string[];
    modified: string[];
    removed: string[];
    unchanged: string[];
  };
  ignored: Array<{ path: string; reason: string }>;
};

export function ProjectUpload({
  projectId,
  currentVersionNumber,
}: {
  projectId: number;
  currentVersionNumber: number;
}) {
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function send(files: File[], zip: File | null) {
    setState("loading");
    setPreview(null);
    const data = new FormData();
    data.set(
      "baseVersionNumber",
      currentVersionNumber > 0 ? String(currentVersionNumber) : "",
    );
    if (zip) data.set("zipFile", zip);
    const rawPaths = files.map(
      (file) =>
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    );
    const folderRoot = rawPaths[0]?.split("/")[0];
    const stripFolderRoot = Boolean(
      folderRoot && rawPaths.every((path) => path.startsWith(`${folderRoot}/`)),
    );
    for (const [index, file] of files.entries()) {
      const rawPath = rawPaths[index];
      const relativePath = stripFolderRoot
        ? rawPath.slice(folderRoot!.length + 1)
        : rawPath;
      data.append("folderFiles", file, relativePath);
      data.append("folderPaths", relativePath);
    }
    try {
      const response = await fetch(
        `/api/projects/${projectId}/upload-preview`,
        {
          method: "POST",
          body: data,
        },
      );
      const result = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setPreview(result);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="utility-panel project-upload-panel">
      <div className="panel-title">
        {currentVersionNumber === 0 ? "PRIMEIRA VERSÃO" : "ATUALIZAR PROJETO"}
      </div>
      {!preview ? (
        <div className="project-upload-picker">
          <p className="panel-help">
            Selecione a pasta atual do projeto. Caches, .git e arquivos
            sensíveis são ignorados no servidor.
          </p>
          <input
            ref={folderInput}
            className="sr-only"
            type="file"
            multiple
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={(event) => void send([...event.target.files!], null)}
          />
          <input
            ref={zipInput}
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) =>
              void send([], event.target.files?.item(0) ?? null)
            }
          />
          <div className="panel-actions">
            <button type="button" onClick={() => folderInput.current?.click()}>
              Selecionar pasta
            </button>
            <button type="button" onClick={() => zipInput.current?.click()}>
              Enviar ZIP
            </button>
          </div>
          {state === "loading" ? (
            <p className="feedback-banner" role="status">
              Validando arquivos e calculando hashes…
            </p>
          ) : state === "error" ? (
            <p className="feedback-banner is-error" role="alert">
              O upload não passou pela validação. Revise limites, paths e o
              formato enviado.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="project-upload-preview">
          <div className="diff-summary">
            <strong>{preview.files} arquivos aceitos</strong>
            <span>+{preview.diff.added.length} adicionados</span>
            <span>~{preview.diff.modified.length} modificados</span>
            <span>−{preview.diff.removed.length} removidos</span>
            <span>{preview.diff.unchanged.length} sem mudança</span>
          </div>
          {(["added", "modified", "removed"] as const).map((kind) => {
            const paths = preview.diff[kind];
            return paths.length ? (
              <details key={kind}>
                <summary>
                  {kind} ({paths.length})
                </summary>
                <ul className="path-list">
                  {paths.map((path) => (
                    <li key={path}>{path}</li>
                  ))}
                </ul>
              </details>
            ) : null;
          })}
          {preview.ignored.length ? (
            <details>
              <summary>
                Ignorados com segurança ({preview.ignored.length})
              </summary>
              <ul className="path-list">
                {preview.ignored.map((item) => (
                  <li key={item.path}>
                    {item.path} <span>— {item.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <form action={confirmProjectUploadAction} className="stack-form">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="token" value={preview.token} />
            <label>
              Descrição desta versão (opcional)
              <input name="message" maxLength={500} />
            </label>
            <button type="submit">Confirmar e sincronizar no Drive</button>
          </form>
          <form action={cancelProjectUploadAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="token" value={preview.token} />
            <button type="submit" className="secondary-button">
              Cancelar
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
