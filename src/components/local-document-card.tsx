import { UiCopy } from "@/components/ui-language-provider";
import {
  deleteLocalDocumentAction,
  setLocalDocumentShareAction,
} from "@/app/documents/local-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { LocalDocument } from "@/lib/v2/local-documents";
import { listLocalDocumentShares } from "@/lib/v2/local-documents";
import type { StudyGroup, VisibleUser } from "@/lib/collaboration";
import type { UiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

export function LocalDocumentCard({
  document,
  people = [],
  groups = [],
  ownerUserId,
  language = "pt-BR",
}: {
  document: LocalDocument;
  people?: VisibleUser[];
  groups?: StudyGroup[];
  ownerUserId?: number;
  language?: UiLanguage;
}) {
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const shares =
    ownerUserId && !document.shared
      ? listLocalDocumentShares(ownerUserId, document.id)
      : { people: [], groups: [] };
  const type =
    document.mimeType === "application/pdf"
      ? "PDF"
      : document.mimeType === "text/plain"
        ? "TXT"
        : "DOCX";
  return (
    <li className="document-library-card local-document-card">
      <a
        className="document-card-open"
        href={`/api/local-document/${document.id}`}
      >
        <span className="document-paper-preview" aria-hidden="true">
          <span className="document-paper-topline">
            {document.shared ? tr("COMPARTILHADO", "SHARED") : tr("ARQUIVO LOCAL", "LOCAL FILE")} · {type}
          </span>
          <strong>{document.name}</strong>
          <span className="document-paper-context">
            {document.subjectName ?? tr("Sem disciplina", "No subject")}
          </span>
          <span className="document-paper-lines">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="document-card-info">
          <strong>{document.name}</strong>
          <small>{document.subjectName ?? tr("Sem disciplina", "No subject")}</small>
          <span>
            <small>{type}<UiCopy pt="· Local" en="· Local" /></small>
            <time dateTime={new Date(document.updatedAt).toISOString()}>
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                document.updatedAt,
              )}
            </time>
          </span>
          <b><UiCopy pt="Baixar arquivo ↓" en="Download file ↓" /></b>
        </span>
      </a>
      {!document.shared && ownerUserId ? (
        <details className="document-card-share">
          <summary><UiCopy pt="Compartilhar" en="Share" /></summary>
          <p><UiCopy pt="Escolha uma pessoa ou grupo. O arquivo continua privado fora dessas escolhas." en="Choose a person or group. The file remains private outside those choices." /></p>
          <form action={setLocalDocumentShareAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="kind" value="person" />
            <input type="hidden" name="enabled" value="true" />
            <label><UiCopy pt="Pessoa" en="Person" />{" "}
              <select name="recipientId" required defaultValue="">
                <option value="" disabled>
                  <UiCopy pt="Selecione" en="Select" />
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!people.length}>
              <UiCopy pt="Compartilhar com pessoa" en="Share with a person" />
            </button>
          </form>
          <form action={setLocalDocumentShareAction}>
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="kind" value="group" />
            <input type="hidden" name="enabled" value="true" />
            <label><UiCopy pt="Grupo" en="Group" />{" "}
              <select name="recipientId" required defaultValue="">
                <option value="" disabled>
                  <UiCopy pt="Selecione" en="Select" />
                </option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={!groups.length}>
              <UiCopy pt="Compartilhar com grupo" en="Share with a group" />
            </button>
          </form>
          {shares.people.map((id) => (
            <form key={`p-${id}`} action={setLocalDocumentShareAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="kind" value="person" />
              <input type="hidden" name="recipientId" value={id} />
              <input type="hidden" name="enabled" value="false" />
              <ConfirmSubmitButton confirmation="Remover o acesso desta pessoa?"><UiCopy pt="Remover" en="Remove" />{" "}
                {people.find((person) => person.id === id)?.displayName ??
                  "pessoa"}
              </ConfirmSubmitButton>
            </form>
          ))}
          {shares.groups.map((id) => (
            <form key={`g-${id}`} action={setLocalDocumentShareAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="kind" value="group" />
              <input type="hidden" name="recipientId" value={id} />
              <input type="hidden" name="enabled" value="false" />
              <ConfirmSubmitButton confirmation="Remover o acesso deste grupo?"><UiCopy pt="Remover" en="Remove" />{" "}
                {groups.find((group) => group.id === id)?.name ?? "grupo"}
              </ConfirmSubmitButton>
            </form>
          ))}
        </details>
      ) : null}
      {!document.shared ? (
        <form
          className="local-document-delete"
          action={deleteLocalDocumentAction}
        >
          <input type="hidden" name="documentId" value={document.id} />
          <ConfirmSubmitButton
            confirmation={tr(`Excluir ${document.name} da sua biblioteca? Esta ação não pode ser desfeita.`, `Delete ${document.name} from your library? This cannot be undone.`)}
          ><UiCopy pt="Excluir arquivo local" en="Delete local file" /></ConfirmSubmitButton>
        </form>
      ) : null}
    </li>
  );
}
