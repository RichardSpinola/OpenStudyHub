"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useMemo, useState } from "react";

import {
  buildProjectFileTree,
  type ProjectBrowserFile,
  type ProjectTreeNode,
} from "@/lib/project-preview";

type Preview =
  { kind: "text"; text: string } | { kind: "binary" | "too-large" };

export function ProjectFileBrowser({
  projectId,
  files,
}: {
  projectId: number;
  files: ProjectBrowserFile[];
}) {
  const tr = useUiText();
  const roots = useMemo(() => buildProjectFileTree(files), [files]);
  const [directory, setDirectory] = useState("");
  const [selected, setSelected] = useState<ProjectBrowserFile | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetch(
      `/api/projects/${projectId}/preview?path=${encodeURIComponent(selected.path)}`,
      {
        signal: controller.signal,
        cache: "no-store",
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("preview-unavailable");
        return response.json() as Promise<Preview>;
      })
      .then(setPreview)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, selected]);

  const current = directory
    ? (directory
        .split("/")
        .reduce<ProjectTreeNode | undefined>(
          (parent, segment, index) =>
            (index === 0 ? roots : (parent?.children ?? [])).find(
              (node) => node.name === segment,
            ),
          undefined,
        )?.children ?? roots)
    : roots;
  const segments = (selected?.path ?? directory).split("/").filter(Boolean);

  function chooseFile(file: ProjectBrowserFile) {
    if (selected?.path === file.path) return;
    setSelected(file);
    setLoading(true);
    setError(false);
    setPreview(null);
  }

  function renderNode(node: ProjectTreeNode) {
    if (node.file) {
      return (
        <li key={node.path}>
          <button
            type="button"
            className="project-file-choice"
            aria-current={selected?.path === node.path ? "true" : undefined}
            onClick={() => chooseFile(node.file!)}
          >
            <span aria-hidden="true">▤</span> {node.name}
          </button>
        </li>
      );
    }
    return (
      <li key={node.path}>
        <details className="project-tree-folder">
          <summary>▸ {node.name}/</summary>
          <button
            type="button"
            className="project-folder-enter"
            onClick={() => {
              setDirectory(node.path);
              setSelected(null);
            }}
          >
            <UiCopy pt="Abrir pasta" en="Open folder" />
          </button>
          <ul>{node.children.map(renderNode)}</ul>
        </details>
      </li>
    );
  }

  return (
    <div className="project-browser-layout">
      <nav className="project-breadcrumb" aria-label="Caminho do arquivo">
        <button
          type="button"
          onClick={() => {
            setDirectory("");
            setSelected(null);
          }}
        >
          <UiCopy pt="Projeto" en="Project" />
        </button>
        {segments.map((segment, index) => {
          const path = segments.slice(0, index + 1).join("/");
          const finalFile = selected && index === segments.length - 1;
          return (
            <span key={path}>
              <span aria-hidden="true"> / </span>
              {finalFile ? (
                <strong>{segment}</strong>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDirectory(path);
                    setSelected(null);
                  }}
                >
                  {segment}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      <div className="project-browser-columns">
        <div className="project-browser-tree">
          <ul>{current.map(renderNode)}</ul>
        </div>
        <div className="project-browser-preview" aria-live="polite">
          {!selected ? (
            <p>
              <UiCopy
                pt="Selecione um arquivo para ver detalhes."
                en="Select a file to see details."
              />
            </p>
          ) : (
            <>
              <h3>{selected.path.split("/").at(-1)}</h3>
              <p>
                {selected.mimeType ??
                  tr("Tipo não informado", "Type unavailable")}{" "}
                · {(selected.sizeBytes / 1024).toFixed(1)} KiB
              </p>
              {loading ? (
                <p>
                  <UiCopy pt="Carregando prévia…" en="Loading preview…" />
                </p>
              ) : error ? (
                <p>
                  <UiCopy
                    pt="Prévia indisponível. Abra o arquivo no Drive."
                    en="Preview unavailable. Open the file in Drive."
                  />
                </p>
              ) : preview?.kind === "text" ? (
                <pre className="project-text-preview">{preview.text}</pre>
              ) : preview?.kind === "too-large" ? (
                <p>
                  <UiCopy
                    pt="Este arquivo é grande demais para pré-visualização."
                    en="This file is too large to preview."
                  />
                </p>
              ) : preview?.kind === "binary" ? (
                <p>
                  <UiCopy
                    pt="Arquivo binário ou formato sem prévia textual."
                    en="Binary file or format without text preview."
                  />
                </p>
              ) : null}
              <a
                href={`https://drive.google.com/file/d/${encodeURIComponent(selected.driveFileId)}/view`}
                target="_blank"
                rel="noreferrer"
              >
                <UiCopy pt="Abrir no Drive ↗" en="Open in Drive ↗" />
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
