import { deleteProjectAction } from "@/app/projects/actions";
import { PendingSubmitButton } from "./pending-submit-button";
import { UiCopy } from "./ui-language-provider";
export function ProjectDeleteForm({
  id,
  name,
  storageBackend,
}: {
  id: number;
  name: string;
  storageBackend: "local" | "google-drive";
}) {
  return (
    <details className="project-delete-confirmation">
      <summary>
        <UiCopy pt="Excluir definitivamente" en="Delete permanently" />
      </summary>
      <p>
        <UiCopy
          pt="Apaga o projeto, os compartilhamentos e todas as versões. Não será possível restaurar."
          en="Deletes the project, shares and all versions. This cannot be undone."
        />{" "}
        {storageBackend === "google-drive" ? (
          <UiCopy
            pt="A pasta e os arquivos deste projeto também serão apagados do Google Drive."
            en="This project's folder and files will also be deleted from Google Drive."
          />
        ) : (
          <UiCopy
            pt="Os arquivos locais deste projeto também serão apagados."
            en="This project's local files will also be deleted."
          />
        )}
      </p>
      <form action={deleteProjectAction}>
        <input type="hidden" name="projectId" value={id} />
        <label>
          <UiCopy
            pt="Para confirmar, digite o nome do projeto:"
            en="To confirm, type the project name:"
          />
          <strong>{name}</strong>
          <input name="confirmation" required autoComplete="off" />
        </label>
        <PendingSubmitButton
          className="danger-button"
          pendingLabel={<UiCopy pt="Excluindo…" en="Deleting…" />}
        >
          <UiCopy
            pt="Excluir projeto e arquivos"
            en="Delete project and files"
          />
        </PendingSubmitButton>
      </form>
    </details>
  );
}
