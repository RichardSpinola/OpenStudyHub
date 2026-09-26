import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";

import {
  createDocumentTemplateAction,
  generateDocumentAction,
  importDocxTemplateAction,
  importStarterDocumentTemplateAction,
  useBundledStarterAction,
} from "@/app/documents/actions";
import { listUserSubjectOfferings } from "@/lib/academic";
import { listUserActivities } from "@/lib/activities";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listUserDocumentTemplates } from "@/lib/document-templates";
import {
  listOfferingParticipants,
  listSharedGeneratedDocuments,
  listUserGeneratedDocuments,
} from "@/lib/document-workflows";
import { listUserStudyGroups, listVisibleUsers } from "@/lib/collaboration";
import { getGoogleConnection } from "@/lib/google/connections";
import { getGooglePickerConfig } from "@/lib/google/config";
import { GoogleDocPicker } from "@/components/google-doc-picker";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { DocumentLibraryCard } from "@/components/document-library-card";
import { LocalDocumentCard } from "@/components/local-document-card";
import { importLocalDocumentAction } from "@/app/documents/local-actions";
import {
  listLocalDocuments,
  listSharedLocalDocuments,
} from "@/lib/v2/local-documents";
import { listBundledStarterTemplates } from "@/lib/starter-document-templates";
import { isDriveStorageAvailableForUser } from "@/lib/google/storage-owner";
import { listOfferingGoogleIntegrations } from "@/lib/google/offering-integrations";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

type View = "generate" | "library" | "shared" | "templates";

type DocumentsPageProps = {
  searchParams: Promise<{
    view?: string;
    offeringId?: string;
    activityId?: string;
    templateId?: string;
    documentId?: string;
    status?: string;
    layout?: string;
    action?: string;
    starterKey?: string;
  }>;
};

function queryId(value: string | undefined): number | null {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function currentView(value: string | undefined): View {
  return value === "generate" || value === "shared" || value === "templates"
    ? value
    : "library";
}

const documentCategoryLabels = {
  activity: "Atividade",
  notes: "Anotações",
  documents: "Documento",
  custom: "Outro",
} as const;
const documentCategoryLabelsEn: Record<
  keyof typeof documentCategoryLabels,
  string
> = {
  activity: "Activity",
  notes: "Notes",
  documents: "Document",
  custom: "Other",
};

const generationErrors: Record<string, string> = {
  "generation-google-not-connected":
    "Conecte novamente sua Conta Google antes de gerar o documento.",
  "generation-docs-unavailable":
    "O Google Docs não está disponível agora. Tente novamente mais tarde.",
  "generation-template-invalid":
    "O documento-base não é um Google Doc válido ou foi movido para a lixeira.",
  "generation-template-access":
    "Sua Conta Google não tem acesso ao documento-base. Abra-o com esta conexão ou use outro modelo.",
  "generation-drive-folder-missing":
    "A pasta Drive desta matéria ainda não foi configurada.",
  "generation-drive-access-pending":
    "O Admin ainda não autorizou sua conta a usar o Drive central.",
  "generation-copy-failed":
    "O Google Drive não conseguiu copiar o documento-base.",
  "generation-merge-failed":
    "A cópia foi criada, mas o preenchimento das seções não pôde ser concluído.",
  "generation-error":
    "Não foi possível gerar o documento com os dados informados.",
  "template-google-not-connected":
    "Conecte novamente sua Conta Google antes de cadastrar o documento-base.",
  "template-template-invalid":
    "O documento-base informado não é um Google Doc válido.",
  "template-template-access":
    "Sua Conta Google não concedeu acesso a esse documento-base para o OpenStudyHub.",
  "template-error": "Não foi possível salvar o modelo informado.",
  "document-delete-error": "Não foi possível excluir este documento.",
};
const generationErrorsEn: Record<string, string> = {
  "generation-google-not-connected":
    "Reconnect your Google Account before generating the document.",
  "generation-docs-unavailable":
    "Google Docs is unavailable right now. Try again later.",
  "generation-template-invalid":
    "The source document is not a valid Google Doc or was moved to trash.",
  "generation-template-access":
    "Your Google Account cannot access the source document. Open it with this connection or choose another template.",
  "generation-drive-folder-missing":
    "The Drive folder for this subject has not been configured yet.",
  "generation-drive-access-pending":
    "Admin has not authorized your account to use central Drive yet.",
  "generation-copy-failed": "Google Drive could not copy the source document.",
  "generation-merge-failed":
    "The copy was created, but its sections could not be filled in.",
  "generation-error":
    "The document could not be generated with the information provided.",
  "template-google-not-connected":
    "Reconnect your Google Account before adding the source document.",
  "template-template-invalid": "The source document is not a valid Google Doc.",
  "template-template-access":
    "Your Google Account did not grant OpenStudyHub access to this source document.",
  "template-error": "The template could not be saved.",
  "document-delete-error": "This document could not be deleted.",
};

const documentStatusMessages: Record<string, string> = {
  "document-removed-hub":
    "Documento removido do OpenStudyHub. O arquivo continua no Google Drive.",
  "document-deleted-drive":
    "Documento removido do OpenStudyHub e enviado para a lixeira do Google Drive.",
};
const documentStatusMessagesEn: Record<string, string> = {
  "document-removed-hub":
    "Document removed from OpenStudyHub. The file remains in Google Drive.",
  "document-deleted-drive":
    "Document removed from OpenStudyHub and sent to Google Drive trash.",
};

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const bundledStarters = listBundledStarterTemplates().filter(
    ({ enabled }) => enabled,
  );
  const parameters = await searchParams;
  const selectedStarter = bundledStarters.find(
    ({ key }) => key === parameters.starterKey,
  );
  const view = currentView(parameters.view);
  const layout = parameters.layout === "list" ? "list" : "grid";
  const offerings = listUserSubjectOfferings(user.id);
  const readyDriveOfferings = new Set(
    listOfferingGoogleIntegrations(
      offerings.map(({ offeringId }) => offeringId),
    )
      .filter(({ driveFolderId }) => Boolean(driveFolderId))
      .map(({ offeringId }) => offeringId),
  );
  const activities = listUserActivities(user.id);
  const templates = listUserDocumentTemplates(user.id);
  const activeTemplates = templates.filter(({ active }) => active);
  const documents = listUserGeneratedDocuments(user.id);
  const localDocuments =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? listLocalDocuments(user.id)
      : [];
  const sharedLocalDocuments =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? listSharedLocalDocuments(user.id)
      : [];
  const sharedDocuments = listSharedGeneratedDocuments(user.id);
  const groups = listUserStudyGroups(user.id);
  const people = listVisibleUsers(user.id);
  const googleConnection = getGoogleConnection(user.id);
  const centralDriveAvailable = isDriveStorageAvailableForUser(user.id);
  const driveWriteAvailable =
    process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? centralDriveAvailable
      : centralDriveAvailable || googleConnection?.status === "connected";
  const pickerConfigured = getGooglePickerConfig() !== null;
  const offeringId = queryId(parameters.offeringId);
  const activityId = queryId(parameters.activityId);
  const requestedTemplateId = queryId(parameters.templateId);
  const generatedDocumentId = queryId(parameters.documentId);
  const generatedDocument =
    documents.find(({ id }) => id === generatedDocumentId) ?? null;
  const selectedTemplate =
    activeTemplates.find(({ id }) => id === requestedTemplateId) ??
    activeTemplates[0] ??
    null;
  let participants: Array<{ id: number; displayName: string }> = [];
  if (offeringId !== null) {
    try {
      participants = listOfferingParticipants(user.id, offeringId);
    } catch {
      participants = [];
    }
  }
  const contextActivities = activities.filter(
    (activity) => activity.offeringId === offeringId,
  );
  const contextGroups = groups.filter(
    (group) =>
      group.subjectOfferingId === null ||
      group.subjectOfferingId === offeringId,
  );

  return (
    <div className="workflow-shell documents-shell resource-workspace">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow">
            <UiCopy pt="BIBLIOTECA E CRIAÇÃO" en="LIBRARY AND CREATION" />
          </p>
          <h1>
            <UiCopy pt="Documentos" en="Documents" />
          </h1>
          <p className="page-description">
            <UiCopy
              pt="Seus documentos, modelos e arquivos compartilhados em um lugar."
              en="Your documents, templates and shared files in one place."
            />
          </p>
        </div>
        <div className="document-header-actions">
          <Link className="primary-link" href="/documents?view=generate">
            <UiCopy pt="+ Novo documento" en="+ New document" />
          </Link>
          <Link href="/documents?view=library#import-local">
            <UiCopy pt="Importar arquivo" en="Import file" />
          </Link>
          <Link href="/documents?view=templates&action=drive#modelo-drive">
            <UiCopy
              pt="Escolher do Google Drive"
              en="Choose from Google Drive"
            />
          </Link>
        </div>
      </header>
      <p className="document-library-note">
        <UiCopy
          pt="Arquivos locais ficam na sua biblioteca. Modelos e Google Drive são opções separadas."
          en="Local files stay in your library. Templates and Google Drive are separate options."
        />
      </p>

      <nav
        className="section-tabs"
        aria-label={tr("Seções de documentos", "Document sections")}
      >
        <Link
          href="/documents?view=library"
          aria-current={view === "library" ? "page" : undefined}
        >
          <UiCopy pt="Meus documentos" en="My documents" />{" "}
          <span>{documents.length + localDocuments.length}</span>
        </Link>
        <Link
          href="/documents?view=generate"
          aria-current={view === "generate" ? "page" : undefined}
        >
          <UiCopy pt="Criar documento" en="Create document" />
        </Link>
        <Link
          href="/documents?view=templates"
          aria-current={view === "templates" ? "page" : undefined}
        >
          <UiCopy pt="Modelos" en="Templates" />{" "}
          <span>{templates.length + bundledStarters.length}</span>
        </Link>
        <Link
          href="/documents?view=shared"
          aria-current={view === "shared" ? "page" : undefined}
        >
          <UiCopy pt="Compartilhados comigo" en="Shared with me" />{" "}
          <span>{sharedDocuments.length + sharedLocalDocuments.length}</span>
        </Link>
      </nav>

      {parameters.status && generationErrors[parameters.status] ? (
        <p className="feedback-banner is-error" role="alert">
          <UiCopy
            pt={generationErrors[parameters.status]}
            en={generationErrorsEn[parameters.status]}
          />
        </p>
      ) : null}

      {parameters.status && documentStatusMessages[parameters.status] ? (
        <p className="feedback-banner" role="status">
          <UiCopy
            pt={documentStatusMessages[parameters.status]}
            en={documentStatusMessagesEn[parameters.status]}
          />
        </p>
      ) : null}
      {parameters.status?.startsWith("local-") ? (
        <p
          className={`feedback-banner ${parameters.status.endsWith("error") ? "is-error" : "is-success"}`}
          role="status"
        >
          {parameters.status === "local-imported" ? (
            <UiCopy
              pt="Arquivo importado para sua biblioteca."
              en="File imported into your library."
            />
          ) : parameters.status === "local-removed" ? (
            <UiCopy pt="Arquivo local excluído." en="Local file deleted." />
          ) : parameters.status === "local-share-saved" ? (
            <UiCopy
              pt="Acesso ao arquivo atualizado."
              en="File access updated."
            />
          ) : parameters.status === "local-share-error" ? (
            <UiCopy
              pt="Não foi possível atualizar o acesso. Confira a pessoa ou o grupo."
              en="Could not update access. Check the person or group."
            />
          ) : (
            <UiCopy
              pt="Não foi possível importar. Use PDF, DOCX ou TXT de até 10 MiB."
              en="Could not import. Use PDF, DOCX or TXT up to 10 MiB."
            />
          )}
        </p>
      ) : null}
      {parameters.status === "starter-error" ? (
        <p className="feedback-banner is-error" role="alert">
          <UiCopy
            pt="Não foi possível usar este modelo agora."
            en="This template could not be used right now."
          />
        </p>
      ) : null}

      {(parameters.status === "generated" ||
        parameters.status === "starter-synced" ||
        parameters.status === "generated-share-warning") &&
      generatedDocument ? (
        <section className="generation-success" role="status">
          <span className="status-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>
              <UiCopy pt="Documento criado" en="Document created" />
            </strong>
            <p>
              {generatedDocument.name} · {generatedDocument.subjectName}
            </p>
          </div>
          <a
            className="primary-link"
            href={generatedDocument.webViewLink}
            target="_blank"
            rel="noreferrer"
          >
            <UiCopy pt="Abrir no Google Docs" en="Open in Google Docs" />
          </a>
          {parameters.status === "generated-share-warning" ? (
            <small>
              <UiCopy
                pt="O documento foi criado, mas o compartilhamento escolhido no Hub não pôde ser aplicado. Você pode tentar compartilhar novamente em Meus documentos."
                en="The document was created, but the chosen sharing in the Hub could not be applied. You can try sharing it again in My documents."
              />
            </small>
          ) : null}
          {generatedDocument.googlePermissionStatus ===
          "needs_authorization" ? (
            <small>
              <UiCopy
                pt="O arquivo foi salvo no Drive central; o acesso Google individual ainda precisa ser autorizado."
                en="The file was saved in central Drive; individual Google access still needs authorization."
              />
            </small>
          ) : null}
          <Link href="/documents?view=library">
            <UiCopy pt="Ver meus documentos" en="View my documents" />
          </Link>
        </section>
      ) : null}

      {view === "generate" ? (
        <section className="utility-panel document-generate-flow">
          <div className="panel-title">
            <span>
              <UiCopy pt="GERAR DOCUMENTO" en="CREATE DOCUMENT" />
            </span>
            <span>
              <UiCopy pt="1–3 minutos" en="1–3 minutes" />
            </span>
          </div>
          {offerings.some(
            ({ offeringId }) => !readyDriveOfferings.has(offeringId),
          ) ? (
            <p className="feedback-banner" role="status">
              <UiCopy
                pt="Há disciplinas sem pasta Drive. O Admin pode criá-las em"
                en="Some subjects have no Drive folder. Admin can create them under"
              />{" "}
              <Link href="/control/google">
                <UiCopy
                  pt="Administração → Integrações"
                  en="Administration → Integrations"
                />
              </Link>
              .
            </p>
          ) : null}
          {selectedStarter ? (
            <form className="document-brief" action={useBundledStarterAction}>
              <input
                type="hidden"
                name="starterKey"
                value={selectedStarter.key}
              />
              <header>
                <span>
                  <UiCopy pt="MODELO INICIAL" en="STARTER TEMPLATE" />
                </span>
                <strong>{selectedStarter.name}</strong>
                <p>{selectedStarter.description}</p>
              </header>
              <label>
                <UiCopy pt="Título do documento" en="Document title" />
                <input
                  name="title"
                  maxLength={160}
                  required
                  placeholder={tr("Digite o título", "Enter a title")}
                />
              </label>
              <label>
                <UiCopy pt="Disciplina" en="Subject" />
                <select
                  name="offeringId"
                  defaultValue={offeringId ?? ""}
                  required
                >
                  <option value="">
                    <UiCopy pt="Escolha uma disciplina" en="Choose a subject" />
                  </option>
                  {offerings.map((offering) => (
                    <option
                      key={offering.offeringId}
                      value={offering.offeringId}
                    >
                      {offering.subjectName} · {offering.periodLabel}
                      {readyDriveOfferings.has(offering.offeringId)
                        ? ""
                        : " · pasta Drive pendente"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="wide-field">
                <strong>
                  <UiCopy pt="Estrutura inicial" en="Starter structure" />
                </strong>
                <ul>
                  {selectedStarter.sections.map((section) => (
                    <li key={section.internalKey}>{section.displayTitle}</li>
                  ))}
                </ul>
                <p>
                  <UiCopy
                    pt="O modelo será importado para seus templates no Drive. Ao criar, os campos da disciplina e do aluno serão preenchidos."
                    en="The template will be imported to your Drive templates. When you create a document, subject and student fields will be filled in."
                  />
                </p>
              </div>
              <PendingSubmitButton
                disabled={!driveWriteAvailable || !offerings.length}
                pendingLabel={tr(
                  "Enviando ao Google Docs…",
                  "Sending to Google Docs…",
                )}
              >
                <UiCopy pt="Criar no Google Docs" en="Create in Google Docs" />
              </PendingSubmitButton>
              <Link href="/documents?view=templates">
                <UiCopy
                  pt="Escolher outro modelo"
                  en="Choose another template"
                />
              </Link>
            </form>
          ) : activeTemplates.length === 0 ? (
            <div className="useful-empty">
              <strong>
                <UiCopy
                  pt="Você ainda não tem modelos ativos"
                  en="You have no active templates yet"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Escolha um modelo inicial ou crie um modelo pessoal antes de gerar."
                  en="Choose a starter template or create a personal template before generating."
                />
              </p>
              <Link href="/documents?view=templates">
                <UiCopy pt="Ver modelos" en="View templates" />
              </Link>
            </div>
          ) : (
            <>
              <form
                className="context-selector"
                action="/documents"
                method="get"
              >
                <input type="hidden" name="view" value="generate" />
                <label>
                  <UiCopy pt="Matéria" en="Subject" />
                  <select
                    name="offeringId"
                    defaultValue={offeringId ?? ""}
                    required
                  >
                    <option value="">
                      <UiCopy pt="Escolha uma matéria" en="Choose a subject" />
                    </option>
                    {offerings.map((offering) => (
                      <option
                        key={offering.offeringId}
                        value={offering.offeringId}
                      >
                        {offering.subjectName} · {offering.periodLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <UiCopy pt="Modelo" en="Template" />
                  <select
                    name="templateId"
                    defaultValue={selectedTemplate?.id ?? ""}
                  >
                    {activeTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                {activityId ? (
                  <input type="hidden" name="activityId" value={activityId} />
                ) : null}
                <button type="submit">
                  <UiCopy pt="Usar este contexto" en="Use this context" />
                </button>
              </form>

              {offeringId && selectedTemplate ? (
                <form
                  className="document-brief"
                  action={generateDocumentAction}
                >
                  <input type="hidden" name="offeringId" value={offeringId} />
                  <input
                    type="hidden"
                    name="templateId"
                    value={selectedTemplate.id}
                  />
                  <header>
                    <span>
                      <UiCopy pt="MODELO" en="TEMPLATE" />
                    </span>
                    <strong>{selectedTemplate.name}</strong>
                    {selectedTemplate.description ? (
                      <p>{selectedTemplate.description}</p>
                    ) : null}
                  </header>
                  <label>
                    <UiCopy pt="Título do documento" en="Document title" />
                    <input
                      name="title"
                      maxLength={180}
                      placeholder={tr("Ex.: Atividade 03", "E.g. Activity 03")}
                      required
                    />
                  </label>
                  <label>
                    <UiCopy pt="Data" en="Date" />
                    <input
                      name="date"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="wide-field">
                    <UiCopy pt="Tema" en="Topic" />{" "}
                    <small>
                      <UiCopy pt="opcional" en="optional" />
                    </small>
                    <input
                      name="topic"
                      maxLength={300}
                      placeholder={tr(
                        "Uma frase curta para contextualizar",
                        "A short phrase for context",
                      )}
                    />
                  </label>
                  <label className="wide-field">
                    <UiCopy pt="Atividade" en="Activity" />{" "}
                    <small>
                      <UiCopy pt="opcional" en="optional" />
                    </small>
                    <select name="activityId" defaultValue={activityId ?? ""}>
                      <option value="">
                        <UiCopy
                          pt="Sem atividade associada"
                          en="No linked activity"
                        />
                      </option>
                      {contextActivities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <UiCopy pt="Categoria no Drive" en="Drive category" />
                    <select
                      name="categoryKind"
                      defaultValue={selectedTemplate.categoryKind}
                    >
                      {Object.entries(documentCategoryLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            <UiCopy
                              pt={label}
                              en={
                                documentCategoryLabelsEn[
                                  value as keyof typeof documentCategoryLabels
                                ]
                              }
                            />
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  {contextGroups.length ? (
                    <label>
                      <UiCopy
                        pt="Compartilhar ao gerar"
                        en="Share when generating"
                      />{" "}
                      <small>
                        <UiCopy pt="opcional" en="optional" />
                      </small>
                      <select name="shareGroupId" defaultValue="">
                        <option value="">
                          <UiCopy pt="Somente eu" en="Only me" />
                        </option>
                        {contextGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <fieldset className="wide-field option-grid">
                    <legend>
                      <UiCopy pt="Aluno(s)" en="Student(s)" />
                    </legend>
                    {participants.map((participant) => (
                      <label key={participant.id}>
                        <input
                          type="checkbox"
                          name="studentUserIds"
                          value={participant.id}
                          defaultChecked={participant.id === user.id}
                        />
                        {participant.displayName}
                      </label>
                    ))}
                  </fieldset>
                  {selectedTemplate.sections.some(
                    ({ optional }) => optional,
                  ) ? (
                    <fieldset className="wide-field option-grid">
                      <legend>
                        <UiCopy pt="Seções opcionais" en="Optional sections" />
                      </legend>
                      {selectedTemplate.sections
                        .filter(({ optional }) => optional)
                        .map((section) => (
                          <label key={section.id}>
                            <input
                              type="checkbox"
                              name="optionalSectionIds"
                              value={section.id}
                              defaultChecked
                            />
                            {section.displayTitle}
                          </label>
                        ))}
                    </fieldset>
                  ) : null}
                  <div className="wide-field generate-action">
                    <p>
                      <UiCopy
                        pt="O arquivo será salvo na categoria escolhida dentro da estrutura Drive desta matéria."
                        en="The file will be saved in the chosen category within this subject's Drive structure."
                      />
                    </p>
                    <PendingSubmitButton
                      disabled={
                        !driveWriteAvailable ||
                        !readyDriveOfferings.has(offeringId)
                      }
                      pendingLabel={tr(
                        "Gerando documento…",
                        "Generating document…",
                      )}
                    >
                      <UiCopy
                        pt="Gerar no Google Docs"
                        en="Generate in Google Docs"
                      />
                    </PendingSubmitButton>
                  </div>
                </form>
              ) : (
                <div className="useful-empty compact">
                  <strong>
                    <UiCopy
                      pt="Escolha a matéria e o modelo"
                      en="Choose a subject and template"
                    />
                  </strong>
                  <p>
                    <UiCopy
                      pt="O contexto da atividade será mantido quando disponível."
                      en="Activity context will be kept when available."
                    />
                  </p>
                </div>
              )}
            </>
          )}
          {!driveWriteAvailable ? (
            <p className="panel-help">
              <UiCopy
                pt="Conecte uma Conta Google ou peça ao administrador para configurar o Drive central."
                en="Connect a Google account or ask the administrator to set up central Drive."
              />
            </p>
          ) : null}
        </section>
      ) : null}

      {view === "library" ? (
        <section
          className="resource-collection document-library"
          aria-labelledby="document-list-title"
        >
          <div className="resource-collection-header">
            <div>
              <span className="page-kicker">
                <UiCopy pt="BIBLIOTECA" en="LIBRARY" />
              </span>
              <h2 id="document-list-title">
                <UiCopy pt="Meus documentos" en="My documents" />{" "}
                <small>{documents.length + localDocuments.length}</small>
              </h2>
            </div>
            <nav
              className="resource-view-toggle"
              aria-label={tr("Visualização dos documentos", "Document view")}
            >
              <Link
                href="/documents?view=library&layout=grid"
                aria-current={layout === "grid" ? "page" : undefined}
              >
                <UiCopy pt="Grade" en="Grid" />
              </Link>
              <Link
                href="/documents?view=library&layout=list"
                aria-current={layout === "list" ? "page" : undefined}
              >
                <UiCopy pt="Lista" en="List" />
              </Link>
            </nav>
          </div>
          {process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
            <form
              id="import-local"
              className="local-document-import"
              action={importLocalDocumentAction}
            >
              <div>
                <strong>
                  <UiCopy pt="Importar arquivo local" en="Import local file" />
                </strong>
                <p>
                  <UiCopy
                    pt="PDF, DOCX ou TXT de até 10 MiB. O arquivo fica privado nesta instalação e pode ser baixado depois."
                    en="PDF, DOCX or TXT up to 10 MiB. The file stays private in this installation and can be downloaded later."
                  />
                </p>
              </div>
              <label>
                <UiCopy pt="Arquivo" en="File" />{" "}
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  required
                />
              </label>
              <label>
                <UiCopy pt="Disciplina" en="Subject" />{" "}
                <select name="offeringId" defaultValue="">
                  <option value="">
                    <UiCopy pt="Sem disciplina" en="No subject" />
                  </option>
                  {offerings.map((offering) => (
                    <option
                      key={offering.offeringId}
                      value={offering.offeringId}
                    >
                      {offering.subjectName}
                    </option>
                  ))}
                </select>
              </label>
              <PendingSubmitButton
                pendingLabel={tr("Importando arquivo…", "Importing file…")}
              >
                <UiCopy pt="Importar" en="Import" />
              </PendingSubmitButton>
            </form>
          ) : null}
          {documents.length + localDocuments.length === 0 ? (
            <div className="useful-empty resource-empty">
              <strong>
                <UiCopy
                  pt="Sua biblioteca de documentos começa aqui"
                  en="Your document library starts here"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Importe um arquivo local ou escolha um modelo para criar o primeiro documento."
                  en="Import a local file or choose a template to create your first document."
                />
              </p>
              <Link href="#import-local">
                <UiCopy pt="Importar arquivo" en="Import file" />
              </Link>
            </div>
          ) : (
            <ul className={`document-library-grid is-${layout}`}>
              {documents.map((document) => (
                <DocumentLibraryCard
                  key={document.id}
                  document={document}
                  groups={groups}
                  people={people}
                  language={language}
                />
              ))}
              {localDocuments.map((document) => (
                <LocalDocumentCard
                  key={`local-${document.id}`}
                  document={document}
                  ownerUserId={user.id}
                  people={people}
                  groups={groups}
                  language={language}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view === "shared" ? (
        <section className="resource-collection document-library">
          <div className="resource-collection-header">
            <div>
              <span className="page-kicker">
                <UiCopy pt="EM GRUPO" en="SHARED" />
              </span>
              <h2>
                <UiCopy pt="Compartilhados com você" en="Shared with you" />{" "}
                <small>
                  {sharedDocuments.length + sharedLocalDocuments.length}
                </small>
              </h2>
            </div>
          </div>
          {sharedDocuments.length + sharedLocalDocuments.length === 0 ? (
            <div className="useful-empty resource-empty">
              <strong>
                <UiCopy
                  pt="Nenhum documento compartilhado"
                  en="No shared documents"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Documentos compartilhados pelos seus grupos aparecerão aqui."
                  en="Documents shared by your groups will appear here."
                />
              </p>
            </div>
          ) : (
            <ul className={`document-library-grid is-${layout}`}>
              {sharedDocuments.map((document) => (
                <DocumentLibraryCard
                  key={document.id}
                  document={document}
                  shared
                  language={language}
                />
              ))}
              {sharedLocalDocuments.map((document) => (
                <LocalDocumentCard
                  key={`local-shared-${document.id}`}
                  document={document}
                  language={language}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view === "templates" ? (
        <div className="template-manager-layout template-workspace">
          <div className="template-workspace-intro">
            <span className="page-kicker">
              <UiCopy pt="PONTO DE PARTIDA" en="STARTING POINT" />
            </span>
            <h2>
              <UiCopy
                pt="Modelos para cada tipo de trabalho"
                en="Templates for every kind of assignment"
              />
            </h2>
            <p>
              <UiCopy
                pt="Escolha um modelo inicial ou use um documento seu. Depois, personalize as seções antes de criar o arquivo final."
                en="Choose a starter template or one of your documents. Then customize its sections before creating the final file."
              />
            </p>
          </div>
          <section className="resource-collection template-catalog">
            <div className="resource-collection-header">
              <div>
                <span className="page-kicker">
                  <UiCopy pt="DISPONÍVEIS" en="AVAILABLE" />
                </span>
                <h2>
                  <UiCopy pt="Modelos iniciais" en="Starter templates" />
                  <small>{bundledStarters.length}</small>
                </h2>
              </div>
            </div>
            <div className="starter-template-list template-gallery">
              {bundledStarters.map((starter) => (
                <div key={starter.key} className="template-gallery-card">
                  <div className="template-sheet-preview" aria-hidden="true">
                    <span>
                      <UiCopy pt="MODELO" en="TEMPLATE" /> ·{" "}
                      <UiCopy
                        pt={documentCategoryLabels[starter.categoryKind]}
                        en={documentCategoryLabelsEn[starter.categoryKind]}
                      />
                    </span>
                    <strong>{starter.name}</strong>
                    {starter.sections.slice(0, 3).map((section) => (
                      <i key={section.internalKey}>{section.displayTitle}</i>
                    ))}
                  </div>
                  <div className="template-gallery-info">
                    <small>
                      <UiCopy
                        pt={documentCategoryLabels[starter.categoryKind]}
                        en={documentCategoryLabelsEn[starter.categoryKind]}
                      />
                    </small>
                    <strong>{starter.name}</strong>
                    <p>{starter.description}</p>
                  </div>
                  <Link
                    href={`/documents?view=generate&starterKey=${starter.key}`}
                    className="primary-link"
                  >
                    <UiCopy pt="Usar modelo →" en="Use template →" />
                  </Link>
                  {driveWriteAvailable ? (
                    <form action={importStarterDocumentTemplateAction}>
                      <input
                        type="hidden"
                        name="starterKey"
                        value={starter.key}
                      />
                      <button type="submit">
                        <UiCopy
                          pt="Personalizar seções"
                          en="Customize sections"
                        />
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            <details
              className="create-template-disclosure template-import-panel"
              id="importar-modelo"
              open={parameters.action === "import"}
            >
              <summary>
                <UiCopy pt="Importar modelo DOCX" en="Import DOCX template" />
              </summary>
              <p>
                <UiCopy
                  pt="O DOCX será convertido em um modelo para novos documentos."
                  en="The DOCX will become a template for new documents."
                />
              </p>
              <form className="workflow-form" action={importDocxTemplateAction}>
                <label>
                  <UiCopy pt="Nome" en="Name" />
                  <input name="name" maxLength={120} required />
                </label>
                <label>
                  <UiCopy pt="Tipo do documento" en="Document type" />
                  <select name="categoryKind" defaultValue="documents">
                    {Object.entries(documentCategoryLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          <UiCopy
                            pt={label}
                            en={
                              documentCategoryLabelsEn[
                                value as keyof typeof documentCategoryLabels
                              ]
                            }
                          />
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  <UiCopy pt="Arquivo DOCX" en="DOCX file" />
                  <input
                    name="docx"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                  />
                </label>
                <label className="wide-field">
                  <UiCopy pt="Descrição" en="Description" />
                  <small>
                    <UiCopy pt="opcional" en="optional" />
                  </small>
                  <input name="description" maxLength={500} />
                </label>
                <input
                  type="hidden"
                  name="namingPattern"
                  value="{{subject.name}} - {{document.title}}"
                />
                <PendingSubmitButton
                  disabled={!driveWriteAvailable}
                  pendingLabel={tr("Importando DOCX…", "Importing DOCX…")}
                >
                  <UiCopy
                    pt="Importar como Google Docs"
                    en="Import as Google Docs"
                  />
                </PendingSubmitButton>
              </form>
            </details>
          </section>

          <section className="resource-collection template-catalog">
            <div className="resource-collection-header">
              <div>
                <span className="page-kicker">
                  <UiCopy pt="PERSONALIZADOS" en="CUSTOM" />
                </span>
                <h2>
                  <UiCopy pt="Seus modelos" en="Your templates" />{" "}
                  <small>{templates.length}</small>
                </h2>
              </div>
            </div>
            <details
              className="create-template-disclosure template-import-panel"
              id="modelo-drive"
              open={parameters.action === "drive"}
            >
              <summary>
                <UiCopy
                  pt="+ Criar modelo ou escolher do Google Drive"
                  en="+ Create a template or choose from Google Drive"
                />
              </summary>
              <form
                className="workflow-form"
                action={createDocumentTemplateAction}
              >
                <label>
                  <UiCopy pt="Nome" en="Name" />
                  <input name="name" maxLength={160} required />
                </label>
                <label>
                  <UiCopy pt="Tipo do documento" en="Document type" />
                  <select name="categoryKind" defaultValue="documents">
                    {Object.entries(documentCategoryLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          <UiCopy
                            pt={label}
                            en={
                              documentCategoryLabelsEn[
                                value as keyof typeof documentCategoryLabels
                              ]
                            }
                          />
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  <UiCopy pt="Nome do arquivo" en="File name" />
                  <input
                    name="namingPattern"
                    defaultValue="{{subject.name}} - {{document.title}} - {{document.date}}"
                    maxLength={240}
                    required
                  />
                </label>
                <label className="wide-field">
                  <UiCopy pt="Descrição" en="Description" />
                  <small>
                    <UiCopy pt="opcional" en="optional" />
                  </small>
                  <input name="description" maxLength={1000} />
                </label>
                <div className="wide-field template-drive-source">
                  <label>
                    <UiCopy
                      pt="Documento base do Google Drive"
                      en="Source document from Google Drive"
                    />{" "}
                    <small>
                      <UiCopy pt="opcional" en="optional" />
                    </small>
                    <input
                      id="google-template-source"
                      name="sourceFile"
                      maxLength={2048}
                      placeholder={tr(
                        "Cole o link do Google Docs ou escolha abaixo",
                        "Paste a Google Docs link or choose below",
                      )}
                    />
                  </label>
                  <GoogleDocPicker
                    configured={pickerConfigured}
                    inputId="google-template-source"
                  />
                </div>
                <input type="hidden" name="active" value="on" />
                <PendingSubmitButton
                  disabled={!driveWriteAvailable}
                  pendingLabel={tr("Criando modelo…", "Creating template…")}
                >
                  <UiCopy pt="Criar modelo" en="Create template" />
                </PendingSubmitButton>
              </form>
            </details>
            {templates.length === 0 ? (
              <div className="useful-empty resource-empty compact">
                <strong>
                  <UiCopy
                    pt="Nenhum modelo pessoal"
                    en="No personal templates"
                  />
                </strong>
                <p>
                  <UiCopy
                    pt="Importe uma base inicial ou crie uma em branco."
                    en="Import a starter file or create a blank template."
                  />
                </p>
              </div>
            ) : (
              <ol className="template-list template-gallery">
                {templates.map((template) => (
                  <li key={template.id}>
                    <Link href={`/documents/templates/${template.id}`}>
                      <div
                        className="template-sheet-preview"
                        aria-hidden="true"
                      >
                        <span>
                          <UiCopy pt="MODELO" en="TEMPLATE" /> ·{" "}
                          <UiCopy
                            pt={documentCategoryLabels[template.categoryKind]}
                            en={documentCategoryLabelsEn[template.categoryKind]}
                          />
                        </span>
                        <strong>{template.name}</strong>
                        {template.sections.slice(0, 3).map((section) => (
                          <i key={section.id}>{section.displayTitle}</i>
                        ))}
                      </div>
                      <div className="template-gallery-info">
                        <small>
                          <UiCopy
                            pt={documentCategoryLabels[template.categoryKind]}
                            en={documentCategoryLabelsEn[template.categoryKind]}
                          />{" "}
                          ·{" "}
                          {template.active ? (
                            <UiCopy pt="Disponível" en="Available" />
                          ) : (
                            <UiCopy pt="Desativado" en="Disabled" />
                          )}
                        </small>
                        <strong>{template.name}</strong>
                        <p>
                          {template.description ?? (
                            <UiCopy
                              pt={`${template.sections.length} seções para personalizar`}
                              en={`${template.sections.length} sections to customize`}
                            />
                          )}
                        </p>
                      </div>
                      <b>
                        <UiCopy
                          pt="Ver e personalizar →"
                          en="View and customize →"
                        />
                      </b>
                    </Link>
                    {template.active ? (
                      <Link
                        className="primary-link"
                        href={`/documents?view=generate&templateId=${template.id}`}
                      >
                        <UiCopy pt="Usar modelo →" en="Use template →" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
