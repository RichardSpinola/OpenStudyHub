"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/ariakit";
import { withCollaboration } from "@blocknote/core/yjs";
import { pt, en } from "@blocknote/core/locales";
import * as Y from "yjs";
import { noteBlockSchema } from "@/lib/note-block-schema";
import { NoteSync, noteBase64 } from "@/lib/note-sync-client";
import type { NoteWorkspaceState } from "@/lib/note-workspace";
import { NoteImagePicker } from "@/components/note-image-picker";
import { noteImageMaxBytes, validNoteImageUrl } from "@/lib/note-image-url";
import { NoteDatabases } from "@/components/note-databases";
import { useUiLanguage, useUiText } from "@/components/ui-language-provider";
import "@blocknote/core/style.css";
import "@blocknote/ariakit/style.css";

export type NoteEditorProps = {
  note: { id: number; title: string };
  userId: number;
  userName: string;
  workspace: NoteWorkspaceState;
};

export default function NoteBlockEditor({
  note,
  userId,
  userName,
  workspace,
}: NoteEditorProps) {
  const tr = useUiText(),
    language = useUiLanguage(),
    router = useRouter();
  const [sync] = useState(() => new NoteSync(note.id, userId, workspace));
  const status = useSyncExternalStore(
    sync.subscribe,
    sync.snapshot,
    sync.snapshot,
  );
  const titleText = sync.doc.getText("title");
  const title = useSyncExternalStore(
    (fn) => {
      titleText.observe(fn);
      return () => titleText.unobserve(fn);
    },
    () => titleText.toString(),
    () => note.title,
  );
  const [fieldsUndo] = useState(
    () =>
      new Y.UndoManager([titleText, sync.doc.getMap("database")], {
        trackedOrigins: new Set(["local-fields"]),
      }),
  );
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [notice, setNotice] = useState("");

  async function uploadImage(file: File) {
    if (!file.size || file.size > noteImageMaxBytes)
      throw new Error(
        tr("Escolha uma imagem de até 5 MB.", "Choose an image up to 5 MB."),
      );
    const response = await fetch(`/api/notes/${note.id}/images`, {
      method: "POST",
      body: file,
      credentials: "same-origin",
    });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url)
      throw new Error(
        result.error ||
          tr(
            "Não foi possível enviar a imagem.",
            "Could not upload the image.",
          ),
      );
    return result.url;
  }
  const editor = useCreateBlockNote(
    withCollaboration({
      schema: noteBlockSchema,
      dictionary: language === "en" ? en : pt,
      uploadFile: async (file: File) => {
        try {
          const url = await uploadImage(file);
          setNotice("");
          return url;
        } catch (error) {
          setNotice(
            error instanceof Error
              ? error.message
              : tr(
                  "Não foi possível enviar a imagem.",
                  "Could not upload the image.",
                ),
          );
          throw error;
        }
      },
      resolveFileUrl: async (url: string) =>
        validNoteImageUrl(url) ? url : "",
      collaboration: {
        fragment: sync.doc.getXmlFragment("document-store"),
        user: { name: userName, color: "#6b8bb6" },
      },
    }),
  );
  useEffect(() => {
    void sync.start();
    const guard = (e: BeforeUnloadEvent) => {
      if (sync.dirty()) {
        e.preventDefault();
      }
    };
    const navigation = (e: MouseEvent) => {
      if (
        !sync.dirty() ||
        e.defaultPrevented ||
        e.button !== 0 ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const link =
        e.target instanceof Element
          ? e.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank") return;
      const target = new URL(link.href);
      if (
        target.origin !== location.origin ||
        target.pathname === location.pathname
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      void sync.flush().then((ok) => {
        if (ok) {
          if (link.hasAttribute("download")) location.assign(target.href);
          else router.push(target.pathname + target.search + target.hash);
        } else
          setNotice(
            tr(
              "A página continua aberta porque há alterações sem salvar. Tente novamente ou baixe o rascunho.",
              "This page is still open because some changes are not saved. Retry or download the draft.",
            ),
          );
      });
    };
    const submission = (e: SubmitEvent) => {
      if (
        !sync.dirty() ||
        !(e.target instanceof HTMLFormElement) ||
        e.defaultPrevented
      )
        return;
      const form = e.target,
        submitter = e.submitter;
      e.preventDefault();
      e.stopPropagation();
      void sync.flush().then((ok) => {
        if (ok && form.isConnected)
          form.requestSubmit(submitter as HTMLButtonElement | null);
        else if (!ok)
          setNotice(
            tr(
              "Salve as alterações ou baixe o rascunho antes de continuar.",
              "Save your changes or download the draft before continuing.",
            ),
          );
      });
    };
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      ),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    window.addEventListener("beforeunload", guard);
    document.addEventListener("click", navigation, true);
    document.addEventListener("submit", submission, true);
    return () => {
      window.removeEventListener("beforeunload", guard);
      document.removeEventListener("click", navigation, true);
      document.removeEventListener("submit", submission, true);
      observer.disconnect();
      sync.stop();
    };
  }, [sync, fieldsUndo, router, tr]);
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("osh:note-title", {
        detail: { id: note.id, title: title || tr("Sem título", "Untitled") },
      }),
    );
  }, [note.id, title, tr]);
  function changeTitle(value: string) {
    if (!status.editable) return;
    const previous = titleText.toString();
    let start = 0;
    while (
      start < previous.length &&
      start < value.length &&
      previous[start] === value[start]
    )
      start++;
    let end = 0;
    while (
      end < previous.length - start &&
      end < value.length - start &&
      previous[previous.length - 1 - end] === value[value.length - 1 - end]
    )
      end++;
    sync.doc.transact(() => {
      titleText.delete(start, previous.length - start - end);
      titleText.insert(start, value.slice(start, value.length - end));
    }, "local-fields");
  }
  async function draft() {
    const json = JSON.stringify(
      {
        format: "openstudyhub-note",
        version: 1,
        title,
        markdown: await editor.blocksToMarkdownLossy(editor.document),
        state: noteBase64(Y.encodeStateAsUpdate(sync.doc)),
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `nota-${note.id}-rascunho.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const message =
    status.phase === "loading"
      ? tr("Abrindo rascunho…", "Opening draft…")
      : status.phase === "saving"
        ? tr("Salvando…", "Saving…")
        : status.phase === "pending"
          ? tr("Alterações pendentes", "Pending changes")
          : status.phase === "offline"
            ? status.local
              ? tr(
                  "Sem conexão · rascunho neste navegador",
                  "Offline · draft in this browser",
                )
              : tr(
                  "Sem conexão · baixe o rascunho",
                  "Offline · download the draft",
                )
            : status.phase === "denied"
              ? tr(
                  "Acesso alterado · edição pausada",
                  "Access changed · editing paused",
                )
              : status.phase === "error"
                ? tr("Não foi possível salvar", "Could not save")
                : tr("Salvo", "Saved");
  return (
    <div className="note-block-workspace">
      <div className="note-writing-status">
        <span
          role="status"
          aria-live="polite"
          className={`note-sync is-${status.phase}`}
        >
          {message}
        </span>
        <span>
          {status.editable
            ? tr("Pode editar", "Can edit")
            : tr("Somente leitura", "Read only")}
        </span>
        {["error", "offline", "pending"].includes(status.phase) ? (
          <button type="button" onClick={() => void sync.flush()}>
            {tr("Tentar salvar", "Retry save")}
          </button>
        ) : null}
      </div>
      {status.error || notice ? (
        <p className="form-error" role="alert">
          {status.error || notice}
        </p>
      ) : null}
      {status.recovered ? (
        <p className="note-recovery-info">
          {tr(
            "Encontramos um rascunho neste navegador. Ele será combinado com a versão salva.",
            "We found a draft in this browser. It will merge with the saved version.",
          )}
        </p>
      ) : null}
      <textarea
        className="note-workspace-title"
        rows={1}
        aria-label={tr("Título da página", "Page title")}
        value={title}
        onChange={(e) => changeTitle(e.target.value.replace(/\r?\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        maxLength={180}
        readOnly={!status.editable}
        placeholder={tr("Sem título", "Untitled")}
      />
      {status.editable ? (
        <div
          className="note-block-toolbar"
          role="toolbar"
          aria-label={tr("Ferramentas da página", "Page tools")}
        >
          <button
            type="button"
            onClick={() => {
              const block = editor.getTextCursorPosition().block;
              const [added] = editor.insertBlocks(
                [{ type: "paragraph" }],
                block,
                "after",
              );
              editor.setTextCursorPosition(added, "start");
              editor.focus();
            }}
          >
            + {tr("Bloco", "Block")}
          </button>
          <NoteImagePicker
            onInsert={async (file, caption) => {
              const url = await uploadImage(file);
              const block = editor.getTextCursorPosition().block;
              const added = editor.insertBlocks(
                [
                  {
                    type: "image",
                    props: { url, name: file.name, caption, previewWidth: 640 },
                  },
                  { type: "paragraph" },
                ],
                block,
                "after",
              );
              editor.setTextCursorPosition(added[1], "start");
              setNotice("");
              requestAnimationFrame(() => editor.focus());
            }}
          />
          <button
            type="button"
            aria-label={tr("Negrito", "Bold")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.toggleStyles({ bold: true });
              editor.focus();
            }}
          >
            <b>B</b>
          </button>
          <button
            type="button"
            aria-label={tr("Itálico", "Italic")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.toggleStyles({ italic: true });
              editor.focus();
            }}
          >
            <i>I</i>
          </button>
          <button
            type="button"
            aria-label={tr("Desfazer texto", "Undo text")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.undo()}
          >
            ↶
          </button>
          <button
            type="button"
            aria-label={tr("Refazer texto", "Redo text")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.redo()}
          >
            ↷
          </button>
          <span>
            {tr("Digite / para escolher um bloco", "Type / to choose a block")}
          </span>
        </div>
      ) : null}
      <BlockNoteView
        editor={editor}
        editable={status.editable && status.phase !== "loading"}
        theme={theme}
        className="osh-note-blocks"
      />
      <NoteDatabases
        doc={sync.doc}
        editable={status.editable && status.phase !== "loading"}
      />
      <footer className="note-local-tools">
        {status.editable ? (
          <>
            <button type="button" onClick={() => fieldsUndo.undo()}>
              {tr("Desfazer título ou base", "Undo title or database")}
            </button>
            <button type="button" onClick={() => fieldsUndo.redo()}>
              {tr("Refazer", "Redo")}
            </button>
          </>
        ) : null}
        <button type="button" onClick={() => void draft()}>
          {tr("Baixar rascunho de recuperação", "Download recovery draft")}
        </button>
      </footer>
    </div>
  );
}
