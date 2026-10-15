"use client";
import dynamic from "next/dynamic";
import { useUiText } from "@/components/ui-language-provider";
import type { NoteEditorProps } from "@/components/note-block-editor";
const Editor = dynamic(() => import("@/components/note-block-editor"), {
  ssr: false,
  loading: () => <p role="status">…</p>,
});
export function NoteEditor(props: NoteEditorProps) {
  const tr = useUiText();
  return (
    <section aria-label={tr("Editor da página", "Page editor")}>
      <Editor key={props.note.id} {...props} />
    </section>
  );
}
