"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  createLocalDocument,
  deleteLocalDocument,
  setLocalDocumentShare,
} from "@/lib/v2/local-documents";

export async function importLocalDocumentAction(form: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > 10 * 1024 * 1024
    )
      throw new Error("Arquivo inválido.");
    const offeringRaw = form.get("offeringId");
    const offeringId =
      typeof offeringRaw === "string" && /^\d+$/.test(offeringRaw)
        ? Number(offeringRaw)
        : null;
    createLocalDocument(
      user.id,
      file.name,
      Buffer.from(await file.arrayBuffer()),
      offeringId,
    );
    revalidatePath("/documents");
  } catch {
    redirect("/documents?view=library&status=local-import-error#import-local");
  }
  redirect("/documents?view=library&status=local-imported");
}

export async function deleteLocalDocumentAction(form: FormData) {
  const user = await requireAuthenticatedUser();
  const documentId = Number(form.get("documentId"));
  if (!Number.isSafeInteger(documentId) || documentId < 1)
    throw new Error("Documento inválido.");
  deleteLocalDocument(user.id, documentId);
  revalidatePath("/documents");
  redirect("/documents?view=library&status=local-removed");
}

export async function setLocalDocumentShareAction(form: FormData) {
  const user = await requireAuthenticatedUser();
  try {
    const documentId = Number(form.get("documentId"));
    const recipientId = Number(form.get("recipientId"));
    const kind = form.get("kind");
    if (kind !== "person" && kind !== "group")
      throw new Error("Destino inválido.");
    setLocalDocumentShare(
      user.id,
      documentId,
      kind,
      recipientId,
      form.get("enabled") === "true",
    );
    revalidatePath("/documents");
  } catch {
    redirect("/documents?view=library&status=local-share-error");
  }
  redirect("/documents?view=library&status=local-share-saved");
}
