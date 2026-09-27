"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useRef, useState } from "react";

import {
  cancelProjectUploadAction,
  confirmProjectUploadAction,
} from "@/app/projects/actions";
import {
  projectLanguageLabels,
  projectLanguages,
  type ProjectLanguage,
} from "@/lib/project-manifest";
import { ProjectSyncSubmit } from "@/components/project-sync-submit";
import { ProjectTechnologyPicker } from "@/components/project-technology-picker";
import type { ProjectTechnology } from "@/lib/project-manifest";

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
  suggestedLanguage: ProjectLanguage;
  suggestedTechnologies: ProjectTechnology[];
};

export function ProjectUpload({
  projectId,
  currentVersionNumber,
  currentLanguage,
  currentTechnologies,
}: {
  projectId: number;
  currentVersionNumber: number;
  currentLanguage: ProjectLanguage;
  currentTechnologies: ProjectTechnology[];
}) {
  const tr = useUiText();
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao preparar o envio.",
      );
      setState("error");
    }
  }

  return (
    <section className="utility-panel project-upload-panel">
      <div className="project-upload-heading">
        <div>
          <p className="eyebrow">
            <UiCopy pt="ARQUIVOS E DIFF" en="FILES AND DIFF" />
          </p>
          <h2>
            {currentVersionNumber === 0
              ? tr("Envie a primeira versão", "Upload the first version")
              : tr("Prepare uma nova versão", "Prepare a new version")}
          </h2>
          <p>
            <UiCopy
              pt="Confira as mudanças antes de sincronizar. Nenhum arquivo é executado aqui."
              en="Review changes before syncing. No file is executed here."
            />
          </p>
        </div>
        <span>
          {currentVersionNumber
            ? `v${String(currentVersionNumber).padStart(4, "0")}`
            : tr("Sem versão", "No version")}
        </span>
      </div>
      {!preview ? (
        <div className="project-upload-picker">
          <p className="panel-help">
            <UiCopy
              pt="Envie a pasta atual ou um ZIP. Arquivos temporários e sensíveis são ignorados com segurança."
              en="Upload the current folder or a ZIP. Temporary and sensitive files are safely ignored."
            />
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
              <UiCopy pt="Selecionar pasta" en="Select folder" />
            </button>
            <button type="button" onClick={() => zipInput.current?.click()}>
              <UiCopy pt="Enviar ZIP" en="Upload ZIP" />
            </button>
          </div>
          {state === "loading" ? (
            <p className="feedback-banner" role="status">
              <UiCopy
                pt="Conferindo os arquivos e preparando a prévia…"
                en="Checking files and preparing the preview…"
              />
            </p>
          ) : state === "error" ? (
            <p className="feedback-banner is-error" role="alert">
              {errorMessage === "version-conflict"
                ? tr(
                    "Existe uma versão mais recente. Atualize a página antes de enviar.",
                    "A newer version exists. Refresh before uploading.",
                  )
                : errorMessage === "invalid-upload"
                  ? tr(
                      "O envio não passou pela validação. Confira o ZIP ou os arquivos.",
                      "The upload did not pass validation. Check the ZIP or files.",
                    )
                  : errorMessage}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="project-upload-preview">
          <div className="diff-summary">
            <strong>
              {preview.files}
              <UiCopy pt="arquivos aceitos" en="accepted files" />
            </strong>
            <span>
              +{preview.diff.added.length}
              <UiCopy pt="adicionados" en="added" />
            </span>
            <span>
              ~{preview.diff.modified.length}
              <UiCopy pt="modificados" en="modified" />
            </span>
            <span>
              −{preview.diff.removed.length}
              <UiCopy pt="removidos" en="removed" />
            </span>
            <span>
              {preview.diff.unchanged.length}
              <UiCopy pt="sem mudança" en="unchanged" />
            </span>
          </div>
          {(["added", "modified", "removed"] as const).map((kind) => {
            const paths = preview.diff[kind];
            const label = {
              added: "Adicionados",
              modified: "Modificados",
              removed: "Removidos",
            }[kind];
            return paths.length ? (
              <details key={kind}>
                <summary>
                  {label} ({paths.length})
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
                <UiCopy pt="Ignorados com segurança (" en="Safely ignored (" />
                {preview.ignored.length})
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
            <input type="hidden" name="technologySelection" value="1" />
            <label>
              <UiCopy
                pt="Linguagem sugerida — você pode corrigir"
                en="Suggested language — you can change it"
              />
              <select
                name="language"
                defaultValue={
                  currentLanguage === "other"
                    ? preview.suggestedLanguage
                    : currentLanguage
                }
              >
                {projectLanguages.map((language) => (
                  <option key={language} value={language}>
                    {projectLanguageLabels[language]}
                  </option>
                ))}
              </select>
            </label>
            <ProjectTechnologyPicker
              key={preview.token}
              initial={
                currentTechnologies.length
                  ? currentTechnologies
                  : preview.suggestedTechnologies
              }
            />
            <label>
              <UiCopy
                pt="Descrição desta versão (opcional)"
                en="Description of this version (optional)"
              />
              <input name="message" maxLength={500} />
            </label>
            <ProjectSyncSubmit />
          </form>
          <form action={cancelProjectUploadAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="token" value={preview.token} />
            <button type="submit" className="secondary-button">
              <UiCopy pt="Cancelar" en="Cancel" />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
