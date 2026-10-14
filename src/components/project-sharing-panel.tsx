import { shareProjectAction } from "@/app/projects/actions";
import { listProjectShares } from "@/lib/v2/project-sharing";
import { listVisibleUsers } from "@/lib/collaboration";
import { UiCopy } from "./ui-language-provider";
export function ProjectSharingPanel({
  projectId,
  ownerId,
}: {
  projectId: number;
  ownerId: number;
}) {
  const shares = listProjectShares(projectId, ownerId),
    people = listVisibleUsers(ownerId).filter((p) => p.id !== ownerId);
  return (
    <section className="utility-panel project-app-sharing">
      <h2>
        <UiCopy pt="Compartilhar no OpenStudyHub" en="Share in OpenStudyHub" />
      </h2>
      <p>
        <UiCopy
          pt="Escolha quem pode visualizar e baixar este projeto. Só você pode alterar arquivos, enviar versões ou arquivá-lo. Compartilhar aqui não muda permissões no Google Drive."
          en="Choose who can view and download this project. Only you can edit files, upload versions or archive it. Sharing here does not change Google Drive permissions."
        />
      </p>
      <form action={shareProjectAction} className="stack-form">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="enabled" value="1" />
        <label>
          <UiCopy pt="Pessoa" en="Person" />
          <select name="recipientId" required>
            <option value="">
              <UiCopy pt="Escolha uma pessoa" en="Choose a person" />
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
        <button disabled={!people.length}>
          <UiCopy pt="Compartilhar para leitura" en="Share for reading" />
        </button>
      </form>
      {shares.length ? (
        <ul>
          {shares.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <form action={shareProjectAction}>
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="recipientId" value={p.id} />
                <input type="hidden" name="enabled" value="0" />
                <button>
                  <UiCopy pt="Remover acesso" en="Remove access" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          <UiCopy
            pt="Privado. Nenhuma pessoa recebeu acesso."
            en="Private. Nobody has been given access."
          />
        </p>
      )}
    </section>
  );
}
