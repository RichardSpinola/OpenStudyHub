"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { recordAuditEvent } from "@/lib/audit";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { createNote, deleteNote, updateNote } from "@/lib/notes";
import { setNoteGroupShare } from "@/lib/collaboration";

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
  };
}

function refresh(noteId?: number) {
  revalidatePath("/notes");
  revalidatePath("/subjects");
  revalidatePath("/activities");
  if (noteId) revalidatePath(`/notes/${noteId}`);
}

export async function createNoteAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
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
  const user = await requireAuthenticatedUser();
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
  const user = await requireAuthenticatedUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
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
  const user = await requireAuthenticatedUser();
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
  const user = await requireAuthenticatedUser();
  const noteId = idSchema.parse(formData.get("noteId"));
  try {
    setNoteGroupShare(
      user.id,
      noteId,
      idSchema.parse(formData.get("groupId")),
      formData.get("shared") === "true",
    );
    refresh(noteId);
  } catch {
    redirect(`/notes/${noteId}?status=error`);
  }
  redirect(`/notes/${noteId}?status=ok`);
}
