"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDatabase } from "@/lib/db/client";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { adminActor } from "@/lib/v2/actor";
import { previewV1Import } from "@/lib/v2/importer";
import { applyAcademicImport } from "@/lib/v2/academic-import";
export async function academicImportAction(form: FormData) {
  let url = "/control/import";
  try {
    await withV2DbAsync(async (db) => {
      const admin = await currentAdminV2(db);
      if (!admin || admin.mustChangePassword)
        throw new Error("Entre como Admin para importar.");
      const path = process.env.DATABASE_PATH;
      if (!path) throw new Error("Banco legado não configurado.");
      const source = createDatabase(path);
      try {
        if (form.get("intent") === "preview") {
          const preview = previewV1Import(source.sqlite, db);
          url += `?run=${preview.runId}`;
        } else {
          const runId = Number(form.get("runId"));
          applyAcademicImport(source.sqlite, db, adminActor(admin.id), {
            runId,
            institutionId: Number(form.get("institutionId")),
            reviewed: form.get("reviewed") === "on",
          });
          url += `?run=${runId}&ok=Importação acadêmica concluída.`;
        }
      } finally {
        source.close();
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Importação não concluída.";
    url +=
      "?error=" +
      encodeURIComponent(
        message.includes("constraint")
          ? "Há um conflito de registros. Nenhum dado foi importado; confira a instituição e os vínculos."
          : message,
      );
  }
  revalidatePath("/control");
  redirect(url);
}
