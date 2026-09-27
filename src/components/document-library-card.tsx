import { UiCopy } from "@/components/ui-language-provider";
import {
  deleteGeneratedDocumentAction,
  setDocumentGroupShareAction,
  setDocumentPersonShareAction,
} from "@/app/documents/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DismissibleDetails } from "@/components/dismissible-details";
import {
  listDocumentGroupShares,
  listDocumentPersonShares,
} from "@/lib/collaboration";
import type { GeneratedDocumentRecord } from "@/lib/document-workflows";
import type { UiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

export function DocumentLibraryCard({
  document,
  shared = false,
  groups = [],
  people = [],
  language = "pt-BR",
}: {
  document: GeneratedDocumentRecord;
  shared?: boolean;
  groups?: Array<{ id: number; name: string }>;
  people?: Array<{ id: number; displayName: string }>;
  language?: UiLanguage;
}) {
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const personShares = shared
    ? []
    : listDocumentPersonShares(document.ownerUserId, document.id);
  const groupShares = shared
    ? []
    : listDocumentGroupShares(document.ownerUserId, document.id);
  const updatedAt = document.googleModifiedAt ?? document.updatedAt;
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
  }).format(updatedAt);

  return (
    <li className="document-library-card">
      <a
        className="document-card-open"
        href={document.webViewLink}
        target="_blank"
        rel="noreferrer"
        aria-label={`Abrir ${document.name} no Google Docs`}
      >
        <span className="document-paper-preview" aria-hidden="true">
          <span className="document-paper-topline">
            <UiCopy pt="DOCUMENTO" en="DOCUMENT" />
          </span>
          <strong>{document.name}</strong>
          <span className="document-paper-context">{document.subjectName}</span>
          <span className="document-paper-lines">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="document-card-info">
          <strong>{document.name}</strong>
          <small>
            {document.subjectName}
            {document.activityTitle ? ` · ${document.activityTitle}` : ""}
          </small>
          <span>
            <small>{document.templateName ?? "Documento"}</small>
            <time dateTime={new Date(updatedAt).toISOString()}>{date}</time>
          </span>
          <b>
            <UiCopy pt="Abrir documento ↗" en="Open document ↗" />
          </b>
        </span>
      </a>
      {!shared ? (
        <details className="document-share-panel">
          <summary>
            <UiCopy pt="Compartilhar" en="Share" />
          </summary>
          <p>
            <UiCopy
              pt="Escolha quem pode ver este documento no Hub. O acesso ao arquivo no Google Drive pode exigir autorização separada."
              en="Choose who can see this document in the Hub. Access to the Google Drive file may require separate authorization."
            />
          </p>
          {personShares.length || groupShares.length ? (
            <ul>
              {personShares.map((person) => (
                <li key={`person-${person.userId}`}>
                  <UiCopy pt="Pessoa:" en="Person:" /> {person.displayName} ·{" "}
                  {person.googlePermissionStatus === "granted"
                    ? "Drive liberado"
                    : "confira o acesso no Drive"}
                  <form action={setDocumentPersonShareAction}>
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input
                      type="hidden"
                      name="recipientUserId"
                      value={person.userId}
                    />
                    <input type="hidden" name="shared" value="false" />
                    <ConfirmSubmitButton
                      confirmation={`Remover acesso de ${person.displayName}?`}
                    >
                      <UiCopy pt="Remover" en="Remove" />
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
              {groupShares.map((group) => (
                <li key={`group-${group.groupId}`}>
                  <UiCopy pt="Grupo:" en="Group:" /> {group.groupName}
                  <form action={setDocumentGroupShareAction}>
                    <input
                      type="hidden"
                      name="documentId"
                      value={document.id}
                    />
                    <input type="hidden" name="groupId" value={group.groupId} />
                    <input type="hidden" name="shared" value="false" />
                    <ConfirmSubmitButton
                      confirmation={`Remover acesso do grupo ${group.groupName}?`}
                    >
                      <UiCopy pt="Remover" en="Remove" />
                    </ConfirmSubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              <UiCopy pt="Privado no Hub." en="Private in the Hub." />
            </p>
          )}
          {people.some(
            ({ id }) => !personShares.some((person) => person.userId === id),
          ) ? (
            <form action={setDocumentPersonShareAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="shared" value="true" />
              <label>
                <UiCopy pt="Pessoa" en="Person" />{" "}
                <select name="recipientUserId" required defaultValue="">
                  <option value="">
                    <UiCopy pt="Selecione" en="Select" />
                  </option>
                  {people
                    .filter(
                      ({ id }) =>
                        !personShares.some((person) => person.userId === id),
                    )
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <button type="submit">
                <UiCopy pt="Compartilhar com pessoa" en="Share with a person" />
              </button>
            </form>
          ) : null}
          {groups.some(
            ({ id }) => !groupShares.some((group) => group.groupId === id),
          ) ? (
            <form action={setDocumentGroupShareAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="shared" value="true" />
              <label>
                <UiCopy pt="Grupo" en="Group" />{" "}
                <select name="groupId" required defaultValue="">
                  <option value="">
                    <UiCopy pt="Selecione" en="Select" />
                  </option>
                  {groups
                    .filter(
                      ({ id }) =>
                        !groupShares.some((group) => group.groupId === id),
                    )
                    .map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                </select>
              </label>
              <button type="submit">
                <UiCopy pt="Compartilhar com grupo" en="Share with a group" />
              </button>
            </form>
          ) : null}
        </details>
      ) : null}
      {!shared ? (
        <DismissibleDetails className="resource-item-actions document-card-options">
          <summary
            aria-label={tr(
              `Opções de ${document.name}`,
              `Options for ${document.name}`,
            )}
          >
            ⋯
          </summary>
          <div>
            <form action={deleteGeneratedDocumentAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="mode" value="hub" />
              <ConfirmSubmitButton
                type="submit"
                confirmation={tr(
                  "Remover este documento da biblioteca? O arquivo continuará no Google Drive.",
                  "Remove this document from the library? The file will remain in Google Drive.",
                )}
              >
                <UiCopy pt="Remover da biblioteca" en="Remove from library" />
              </ConfirmSubmitButton>
            </form>
            <form action={deleteGeneratedDocumentAction}>
              <input type="hidden" name="documentId" value={document.id} />
              <input type="hidden" name="mode" value="drive" />
              <ConfirmSubmitButton
                type="submit"
                className="danger-button"
                confirmation={tr(
                  "Mover este arquivo para a lixeira do Google Drive e removê-lo da biblioteca?",
                  "Move this file to Google Drive trash and remove it from the library?",
                )}
              >
                <UiCopy
                  pt="Excluir também do Drive"
                  en="Delete from Drive too"
                />
              </ConfirmSubmitButton>
            </form>
            <p>
              <UiCopy
                pt="Remover da biblioteca mantém o arquivo no Drive."
                en="Removing it from the library keeps the file in Drive."
              />
            </p>
          </div>
        </DismissibleDetails>
      ) : null}
    </li>
  );
}
