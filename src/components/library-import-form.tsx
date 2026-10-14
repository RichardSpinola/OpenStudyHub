import { importLocalDocumentAction } from "@/app/documents/local-actions";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listUserSubjectOfferings } from "@/lib/academic";
import { PendingSubmitButton } from "./pending-submit-button";
import { UiCopy } from "./ui-language-provider";
export async function LibraryImportForm() {
  const user = await requireAuthenticatedUser(),
    offerings = listUserSubjectOfferings(user.id);
  return (
    <section className="utility-panel library-import-workspace">
      <header>
        <h2>
          <UiCopy pt="Importar arquivo" en="Import file" />
        </h2>
        <p>
          <UiCopy
            pt="Guarde um PDF, DOCX ou TXT de até 10 MiB nesta instalação. Disciplina é opcional; o arquivo começa privado."
            en="Store a PDF, DOCX or TXT up to 10 MiB in this installation. Subject is optional; the file starts private."
          />
        </p>
      </header>
      <form action={importLocalDocumentAction} className="workflow-form">
        <label>
          <UiCopy pt="Arquivo" en="File" />
          <input name="file" type="file" accept=".pdf,.docx,.txt" required />
        </label>
        <label>
          <UiCopy pt="Disciplina (opcional)" en="Subject (optional)" />
          <select name="offeringId" defaultValue="">
            <option value="">
              <UiCopy pt="Sem disciplina" en="No subject" />
            </option>
            {offerings.map((o) => (
              <option key={o.offeringId} value={o.offeringId}>
                {o.subjectName}
              </option>
            ))}
          </select>
        </label>
        <PendingSubmitButton
          pendingLabel={<UiCopy pt="Importando…" en="Importing…" />}
        >
          <UiCopy pt="Importar para a Biblioteca" en="Import into Library" />
        </PendingSubmitButton>
      </form>
    </section>
  );
}
