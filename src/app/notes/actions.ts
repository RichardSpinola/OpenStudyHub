"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { copyNoteWorkspace } from "@/lib/note-workspace";
import { recordAuditEvent } from "@/lib/audit";
import { requireToolUser } from "@/lib/authorization";
import {
  createNote,
  deleteNote,
  updateNote,
  moveNote,
  updateNoteContext,
} from "@/lib/notes";
import { setNoteGroupShare, setNotePersonShare } from "@/lib/collaboration";

const idSchema = z.coerce.number().int().positive();
const optionalIdSchema = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.coerce.number().int().positive().nullable(),
);
const autosaveInputSchema = z.object({
  noteId: z.number().int().positive(),
  title: z.string().trim().min(1).max(180),
  content: z.string().max(100000),
  offeringId: z.number().int().positive().nullable(),
  activityId: z.number().int().positive().nullable(),
});

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function noteInput(formData: FormData) {
  return {
    title: text(formData, "title"),
    content: text(formData, "content"),
    offeringId: optionalIdSchema.parse(formData.get("offeringId")),
    activityId: optionalIdSchema.parse(formData.get("activityId")),
    parentNoteId: optionalIdSchema.parse(formData.get("parentNoteId")),
  };
}

function refresh(noteId?: number) {
  revalidatePath("/notes");
  revalidatePath("/subjects");
  revalidatePath("/activities");
  if (noteId) revalidatePath(`/notes/${noteId}`);
}

export async function createNoteAction(formData: FormData) {
  const user = await requireToolUser();
  let noteId: number;
  try {
    const note = createNote(user.id, noteInput(formData));
    noteId = note.id;
    recordAuditEvent({
      actorUserId: user.id,
      action: "note.create",
      targetType: "note",
      targetId: String(note.id),
      summary: "private note created",
    });
    refresh(note.id);
  } catch {
    redirect("/notes?status=error");
  }
  redirect(`/notes/${noteId}`);
}

export async function updateNoteAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    updateNote(user.id, noteId, noteInput(formData));
    recordAuditEvent({
      actorUserId: user.id,
      action: "note.update",
      targetType: "note",
      targetId: String(noteId),
      summary: "private note updated",
    });
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect(`/notes/${noteId}?status=ok`);
}

export async function deleteNoteAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    if (!["EXCLUIR", "DELETE"].includes(text(formData, "confirmation")))
      throw new Error("Confirme a exclusão.");
    deleteNote(user.id, noteId);
    recordAuditEvent({
      actorUserId: user.id,
      action: "note.delete",
      targetType: "note",
      targetId: String(noteId),
      summary: "private note deleted",
    });
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect("/notes?status=deleted");
}

export async function autosaveNoteAction(
  input: z.input<typeof autosaveInputSchema>,
): Promise<{ ok: boolean }> {
  const user = await requireToolUser();
  try {
    const value = autosaveInputSchema.parse(input);
    updateNote(user.id, value.noteId, {
      title: value.title,
      content: value.content,
      offeringId: value.offeringId,
      activityId: value.activityId,
    });
    revalidatePath("/notes");
    revalidatePath("/subjects");
    revalidatePath("/activities");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function setNoteGroupShareAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    setNoteGroupShare(
      user.id,
      noteId,
      idSchema.parse(formData.get("groupId")),
      formData.get("shared") === "true",
      undefined,
      formData.get("permission") === "edit",
    );
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect(`/notes/${noteId}?status=ok`);
}

export async function setNotePersonShareAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    setNotePersonShare(
      user.id,
      noteId,
      idSchema.parse(formData.get("recipientUserId")),
      formData.get("shared") === "true",
      undefined,
      formData.get("permission") === "edit",
    );
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error#note-sharing`);
  }
  redirect(`/notes/${noteId}?status=ok#note-sharing`);
}

export async function moveNoteAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    moveNote(
      user.id,
      noteId,
      optionalIdSchema.parse(formData.get("parentNoteId")),
    );
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect(`/notes/${noteId}`);
}
export async function updateNoteContextAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    updateNoteContext(
      user.id,
      noteId,
      optionalIdSchema.parse(formData.get("offeringId")),
      optionalIdSchema.parse(formData.get("activityId")),
    );
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=context-error`);
  }
  redirect(`/notes/${noteId}?status=context-saved`);
}
export async function copyNoteAction(formData: FormData) {
  const user = await requireToolUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  let id: number;
  try {
    const revision = formData.get("revision");
    id = copyNoteWorkspace(
      user.id,
      noteId,
      revision === null || revision === ""
        ? undefined
        : z.coerce.number().int().nonnegative().parse(revision),
    ).id;
    refresh(id);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect(`/notes/${id}`);
}

export async function createImportedNoteAction(
  formData: FormData,
): Promise<{ id?: number; error?: string }> {
  const user = await requireToolUser();
  try {
    const { importNoteWorkspace } = await import("@/lib/note-workspace");
    const filename = z.string().min(1).max(255).parse(formData.get("filename"));
    const content = z.string().max(2_100_000).parse(formData.get("content"));
    const note = importNoteWorkspace(user.id, filename, content);
    refresh(note.id);
    return { id: note.id };
  } catch {
    return {
      error:
        "Não foi possível importar. Use Markdown/texto de até 100 KB ou um rascunho JSON do OpenStudyHub de até 2 MB.",
    };
  }
}
