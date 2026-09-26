"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import { useEffect, useRef, useState } from "react";

import { autosaveNoteAction } from "@/app/notes/actions";
import {
  markdownToEditorHtml,
  type NoteFormat,
} from "@/lib/note-editor-format";

type Option = { id: number; label: string; offeringId?: number };

export function NoteEditor({
  note,
  offerings,
  activities,
}: {
  note: {
    id: number;
    title: string;
    content: string;
    offeringId: number | null;
    activityId: number | null;
  };
  offerings: Option[];
  activities: Option[];
}) {
  const tr = useUiText();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [offeringId, setOfferingId] = useState(note.offeringId);
  const [activityId, setActivityId] = useState(note.activityId);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const editorRef = useRef<HTMLDivElement>(null);
  const [initialEditorHtml] = useState(() =>
    markdownToEditorHtml(note.content),
  );
  const initialRender = useRef(true);
  const revision = useRef(0);

  const visibleActivities = activities.filter(
    (activity) => offeringId === null || activity.offeringId === offeringId,
  );

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const currentRevision = ++revision.current;
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      void autosaveNoteAction({
        noteId: note.id,
        title,
        content,
        offeringId,
        activityId,
      }).then((result) => {
        if (revision.current !== currentRevision) return;
        setSaveState(result.ok ? "saved" : "error");
      });
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activityId, content, note.id, offeringId, title]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (saveState !== "saving" && saveState !== "error") return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [saveState]);

  useEffect(() => {
    const guardNavigation = (event: MouseEvent) => {
      if (saveState !== "saving" && saveState !== "error") return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.href === window.location.href
      )
        return;
      if (
        !window.confirm(
          tr(
            "Há alterações sendo salvas. Salvar antes de sair desta nota?",
            "Changes are still being saved. Save before leaving this note?",
          ),
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void autosaveNoteAction({
        noteId: note.id,
        title,
        content,
        offeringId,
        activityId,
      }).then((result) => {
        if (result.ok) window.location.assign(destination.href);
        else setSaveState("error");
      });
    };
    document.addEventListener("click", guardNavigation, true);
    return () => document.removeEventListener("click", guardNavigation, true);
  }, [activityId, content, note.id, offeringId, saveState, title, tr]);

  function serializeNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const children = () => [...node.childNodes].map(serializeNode).join("");
    const text = children();
    switch (node.tagName) {
      case "BR":
        return "\n";
      case "H1":
      case "H2":
      case "H3":
      case "H4":
      case "H5":
      case "H6":
        return `${"#".repeat(Number(node.tagName.slice(1)))} ${text}\n\n`;
      case "STRONG":
      case "B":
        return `**${text}**`;
      case "EM":
      case "I":
        return `_${text}_`;
      case "CODE":
        return node.parentElement?.tagName === "PRE" ? text : `\`${text}\``;
      case "PRE":
        return `\`\`\`\n${text}\n\`\`\`\n\n`;
      case "BLOCKQUOTE":
        return `${text
          .trimEnd()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n")}\n\n`;
      case "A": {
        const href = node.getAttribute("href") ?? "";
        try {
          const url = new URL(href);
          return ["https:", "http:", "mailto:"].includes(url.protocol)
            ? `[${text}](${url.toString()})`
            : text;
        } catch {
          return text;
        }
      }
      case "LI": {
        const parent = node.parentElement?.tagName;
        const marker = node.dataset.task
          ? node.dataset.task === "done"
            ? "- [x] "
            : "- [ ] "
          : parent === "OL"
            ? `${[...node.parentElement!.children].indexOf(node) + 1}. `
            : "- ";
        return `${marker}${text.replace(/^[☐☑]\s*/u, "")}\n`;
      }
      case "UL":
      case "OL":
        return `${text}\n`;
      case "P":
      case "DIV":
        return `${text}\n\n`;
      default:
        return text;
    }
  }

  function syncMarkdown() {
    const editor = editorRef.current;
    if (!editor) return;
    setContent(
      [...editor.childNodes]
        .map(serializeNode)
        .join("")
        .replaceAll(/\n{3,}/gu, "\n\n")
        .trimEnd(),
    );
  }

  async function saveNow() {
    const currentRevision = ++revision.current;
    setSaveState("saving");
    try {
      const result = await autosaveNoteAction({
        noteId: note.id,
        title,
        content,
        offeringId,
        activityId,
      });
      if (revision.current === currentRevision)
        setSaveState(result.ok ? "saved" : "error");
    } catch {
      if (revision.current === currentRevision) setSaveState("error");
    }
  }

  function format(formatType: NoteFormat) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (formatType === "heading")
      document.execCommand("formatBlock", false, "h2");
    else if (formatType === "bold") document.execCommand("bold");
    else if (formatType === "italic") document.execCommand("italic");
    else if (formatType === "bullet")
      document.execCommand("insertUnorderedList");
    else if (formatType === "numbered")
      document.execCommand("insertOrderedList");
    else if (formatType === "quote")
      document.execCommand("formatBlock", false, "blockquote");
    else if (formatType === "code-block")
      document.execCommand("formatBlock", false, "pre");
    else if (formatType === "checklist")
      document.execCommand(
        "insertHTML",
        false,
        '<ul class="task-list"><li data-task="open"><span contenteditable="false">☐</span> <UiCopy pt="tarefa" en="task" /></li></ul>',
      );
    else if (formatType === "link") {
      const href = window.prompt("URL HTTPS do link");
      if (href) {
        try {
          const url = new URL(href);
          if (["https:", "http:", "mailto:"].includes(url.protocol)) {
            document.execCommand("createLink", false, url.toString());
          }
        } catch {
          // Invalid links are ignored without changing the note.
        }
      }
    } else if (formatType === "inline-code") {
      const selection = window.getSelection();
      if (selection?.rangeCount && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const code = document.createElement("code");
        code.append(range.extractContents());
        range.insertNode(code);
        selection.removeAllRanges();
        range.selectNodeContents(code);
        selection.addRange(range);
      }
    }
    syncMarkdown();
  }

  const toolbar: Array<[string, NoteFormat, string]> = [
    ["H2", "heading", "Título"],
    ["B", "bold", "Negrito"],
    ["I", "italic", "Itálico"],
    ["•", "bullet", "Lista"],
    ["1.", "numbered", "Lista numerada"],
    ["☑", "checklist", "Checklist"],
    ["❯", "quote", "Citação"],
    ["<>", "inline-code", "Código em linha"],
    ["{ }", "code-block", "Bloco de código"],
    ["↗", "link", "Link"],
  ];

  return (
    <div className="note-page-editor">
      <div className="note-editor-context">
        <label>
          <UiCopy pt="Matéria" en="Subject" />
          <select
            value={offeringId ?? ""}
            onChange={(event) => {
              const next = event.target.value
                ? Number(event.target.value)
                : null;
              setOfferingId(next);
              if (
                activityId !== null &&
                activities.find(({ id }) => id === activityId)?.offeringId !==
                  next
              ) {
                setActivityId(null);
              }
            }}
          >
            <option value="">
              <UiCopy pt="Sem matéria" en="No subject" />
            </option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <UiCopy pt="Atividade" en="Activity" />
          <select
            value={activityId ?? ""}
            onChange={(event) =>
              setActivityId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
          >
            <option value="">
              <UiCopy pt="Sem atividade" en="No activity" />
            </option>
            {visibleActivities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
        <div className="note-editor-save-actions">
          <span
            className={`autosave-state is-${saveState}`}
            role="status"
            aria-live="polite"
          >
            {saveState === "saving"
              ? tr("Salvando…", "Saving…")
              : saveState === "error"
                ? tr("Não foi possível salvar", "Could not save")
                : saveState === "saved"
                  ? tr("Salvo", "Saved")
                  : tr("Pronto para escrever", "Ready to write")}
          </span>
          <button type="button" onClick={() => void saveNow()}>
            <UiCopy pt="Salvar agora" en="Save now" />
          </button>
        </div>
      </div>
      <input
        className="note-title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={180}
        aria-label={tr("Título da nota", "Note title")}
      />
      <p className="note-editor-writing-label">
        <UiCopy pt="SUA PÁGINA" en="YOUR PAGE" />
      </p>
      <div
        className="note-format-toolbar"
        aria-label={tr("Formatação da nota", "Note formatting")}
      >
        {toolbar.map(([label, command, titleText]) => (
          <button
            key={command}
            type="button"
            title={tr(
              titleText,
              {
                heading: "Heading",
                bold: "Bold",
                italic: "Italic",
                bullet: "Bulleted list",
                numbered: "Numbered list",
                checklist: "Checklist",
                quote: "Quote",
                "inline-code": "Inline code",
                "code-block": "Code block",
                link: "Link",
              }[command],
            )}
            aria-label={tr(
              titleText,
              {
                heading: "Heading",
                bold: "Bold",
                italic: "Italic",
                bullet: "Bulleted list",
                numbered: "Numbered list",
                checklist: "Checklist",
                quote: "Quote",
                "inline-code": "Inline code",
                "code-block": "Code block",
                link: "Link",
              }[command],
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(command)}
          >
            {label}
          </button>
        ))}
        <span className="toolbar-separator" />
        <button
          type="button"
          aria-label={tr("Desfazer", "Undo")}
          title={tr("Desfazer", "Undo")}
          onClick={() => {
            document.execCommand("undo");
            syncMarkdown();
          }}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label={tr("Refazer", "Redo")}
          title={tr("Refazer", "Redo")}
          onClick={() => {
            document.execCommand("redo");
            syncMarkdown();
          }}
        >
          ↷
        </button>
      </div>
      <div
        ref={editorRef}
        className="note-content-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={tr("Comece a escrever…", "Start writing…")}
        onInput={syncMarkdown}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          syncMarkdown();
        }}
        dangerouslySetInnerHTML={{ __html: initialEditorHtml }}
        aria-label={tr("Conteúdo da nota", "Note content")}
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
}
