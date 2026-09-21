import Link from "next/link";

import {
  createDocumentTemplateAction,
  deleteGeneratedDocumentAction,
  generateDocumentAction,
  importDocxTemplateAction,
  importStarterDocumentTemplateAction,
  setDocumentGroupShareAction,
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
import { listUserStudyGroups } from "@/lib/collaboration";
import { getGoogleConnection } from "@/lib/google/connections";
import { getGooglePickerConfig } from "@/lib/google/config";
import { GoogleDocPicker } from "@/components/google-doc-picker";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  getConfiguredStarterDocumentTemplateKeys,
  starterDocumentTemplates,
} from "@/lib/starter-document-templates";
import { isConfiguredDriveStorageAvailable } from "@/lib/google/storage-owner";

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
  }>;
};

function queryId(value: string | undefined): number | null {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

function currentView(value: string | undefined): View {
  return value === "library" || value === "shared" || value === "templates"
    ? value
    : "generate";
}

const documentCategoryLabels = {
  activity: "Atividade",
  notes: "Anotações",
  documents: "Documento",
  custom: "Outro",
} as const;

const generationErrors: Record<string, string> = {
  "generation-google-not-connected":
    "Conecte novamente sua Conta Google antes de gerar o documento.",
  "generation-docs-unavailable":
    "A API do Google Docs está indisponível ou não foi habilitada nesta instância.",
  "generation-template-invalid":
    "O documento-base não é um Google Doc válido ou foi movido para a lixeira.",
  "generation-template-access":
    "Sua Conta Google não tem acesso ao documento-base. Abra-o com esta conexão ou use outro modelo.",
  "generation-drive-folder-missing":
    "A pasta Drive desta matéria ainda não foi configurada.",
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

const documentStatusMessages: Record<string, string> = {
  "document-removed-hub":
    "Documento removido do OpenStudyHub. O arquivo continua no Google Drive.",
  "document-deleted-drive":
    "Documento removido do OpenStudyHub e enviado para a lixeira do Google Drive.",
};

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const user = await requireAuthenticatedUser();
  const configuredStarters = getConfiguredStarterDocumentTemplateKeys();
  const parameters = await searchParams;
  const view = currentView(parameters.view);
  const offerings = listUserSubjectOfferings(user.id);
  const activities = listUserActivities(user.id);
  const templates = listUserDocumentTemplates(user.id);
  const activeTemplates = templates.filter(({ active }) => active);
  const documents = listUserGeneratedDocuments(user.id);
  const sharedDocuments = listSharedGeneratedDocuments(user.id);
  const groups = listUserStudyGroups(user.id);
  const googleConnection = getGoogleConnection(user.id);
  const centralDriveAvailable = isConfiguredDriveStorageAvailable();
  const driveWriteAvailable =
    centralDriveAvailable || googleConnection?.status === "connected";
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
    <div className="workflow-shell documents-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">GOOGLE DOCS / DRIVE</p>
          <h1>DOCUMENTOS</h1>
          <p className="page-description">
            Crie arquivos no Drive da matéria e continue escrevendo no Google
            Docs.
          </p>
        </div>
        <Link className="text-link" href="/notes">
          Ir para notas
        </Link>
      </header>

      <nav className="section-tabs" aria-label="Seções de documentos">
        <Link
          href="/documents?view=generate"
          aria-current={view === "generate" ? "page" : undefined}
        >
          Gerar documento
        </Link>
        <Link
          href="/documents?view=library"
          aria-current={view === "library" ? "page" : undefined}
        >
          Meus documentos <span>{documents.length}</span>
        </Link>
        <Link
          href="/documents?view=shared"
          aria-current={view === "shared" ? "page" : undefined}
        >
          Compartilhados comigo <span>{sharedDocuments.length}</span>
        </Link>
        <Link
          href="/documents?view=templates"
          aria-current={view === "templates" ? "page" : undefined}
        >
          Gerenciar modelos <span>{templates.length}</span>
        </Link>
      </nav>

      {parameters.status && generationErrors[parameters.status] ? (
        <p className="feedback-banner is-error" role="alert">
          {generationErrors[parameters.status]}
        </p>
      ) : null}

      {parameters.status && documentStatusMessages[parameters.status] ? (
        <p className="feedback-banner" role="status">
          {documentStatusMessages[parameters.status]}
        </p>
      ) : null}

      {(parameters.status === "generated" ||
        parameters.status === "generated-share-warning") &&
      generatedDocument ? (
        <section className="generation-success" role="status">
          <span className="status-mark" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Documento criado</strong>
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
            Abrir no Google Docs
          </a>
          {parameters.status === "generated-share-warning" ? (
            <small>
              O documento foi criado, mas o compartilhamento escolhido no Hub
              não pôde ser aplicado. Você pode tentar compartilhar novamente em
              Meus documentos.
            </small>
          ) : null}
          {generatedDocument.googlePermissionStatus ===
          "needs_authorization" ? (
            <small>
              O arquivo foi salvo no Drive central; o acesso Google individual
              ainda precisa ser autorizado.
            </small>
          ) : null}
          <Link href="/documents?view=library">Ver meus documentos</Link>
        </section>
      ) : null}

      {view === "generate" ? (
        <section className="utility-panel document-generate-flow">
          <div className="panel-title">
            <span>GERAR DOCUMENTO</span>
            <span>1–3 minutos</span>
          </div>
          {activeTemplates.length === 0 ? (
            <div className="useful-empty">
              <strong>Você ainda não tem modelos ativos</strong>
              <p>
                Importe um dos modelos iniciais ou crie um modelo pessoal antes
                de gerar.
              </p>
              <Link href="/documents?view=templates">Gerenciar modelos</Link>
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
                  Matéria
                  <select
                    name="offeringId"
                    defaultValue={offeringId ?? ""}
                    required
                  >
                    <option value="">Escolha uma matéria</option>
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
                  Modelo
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
                <button type="submit">Usar este contexto</button>
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
                    <span>MODELO</span>
                    <strong>{selectedTemplate.name}</strong>
                    {selectedTemplate.description ? (
                      <p>{selectedTemplate.description}</p>
                    ) : null}
                  </header>
                  <label>
                    Título do documento
                    <input
                      name="title"
                      maxLength={180}
                      placeholder="Ex.: Atividade 03"
                      required
                    />
                  </label>
                  <label>
                    Data
                    <input
                      name="date"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="wide-field">
                    Tema <small>opcional</small>
                    <input
                      name="topic"
                      maxLength={300}
                      placeholder="Uma frase curta para contextualizar"
                    />
                  </label>
                  <label className="wide-field">
                    Atividade <small>opcional</small>
                    <select name="activityId" defaultValue={activityId ?? ""}>
                      <option value="">Sem atividade associada</option>
                      {contextActivities.map((activity) => (
                        <option key={activity.id} value={activity.id}>
                          {activity.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Categoria no Drive
                    <select
                      name="categoryKind"
                      defaultValue={selectedTemplate.categoryKind}
                    >
                      {Object.entries(documentCategoryLabels).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  {contextGroups.length ? (
                    <label>
                      Compartilhar ao gerar <small>opcional</small>
                      <select name="shareGroupId" defaultValue="">
                        <option value="">Somente eu</option>
                        {contextGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <fieldset className="wide-field option-grid">
                    <legend>Aluno(s)</legend>
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
                      <legend>Seções opcionais</legend>
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
                      O arquivo será salvo na categoria escolhida dentro da
                      estrutura Drive desta matéria.
                    </p>
                    <PendingSubmitButton
                      disabled={!driveWriteAvailable}
                      pendingLabel="Gerando documento…"
                    >
                      Gerar no Google Docs
                    </PendingSubmitButton>
                  </div>
                </form>
              ) : (
                <div className="useful-empty compact">
                  <strong>Escolha a matéria e o modelo</strong>
                  <p>O contexto da Activity será mantido quando disponível.</p>
                </div>
              )}
            </>
          )}
          {!driveWriteAvailable ? (
            <p className="panel-help">
              Conecte uma Conta Google ou peça ao administrador para configurar
              o Drive central.
            </p>
          ) : null}
        </section>
      ) : null}

      {view === "library" ? (
        <section className="utility-panel document-library">
          <div className="panel-title">
            <span>MEUS DOCUMENTOS</span>
            <span>{documents.length.toString().padStart(2, "0")}</span>
          </div>
          {documents.length === 0 ? (
            <div className="useful-empty">
              <strong>Nenhum documento gerado</strong>
              <p>Escolha um modelo e uma matéria para criar o primeiro.</p>
              <Link href="/documents?view=generate">Gerar documento</Link>
            </div>
          ) : (
            <ol className="generated-document-list document-cards">
              {documents.map((document) => (
                <li key={document.id}>
                  <a
                    className="generated-document-link"
                    href={document.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <strong>{document.name}</strong>
                      <span>
                        {document.subjectName}
                        {document.activityTitle
                          ? ` · ${document.activityTitle}`
                          : ""}
                      </span>
                    </div>
                    <span>{document.templateName ?? "Modelo removido"}</span>
                    <time dateTime={new Date(document.createdAt).toISOString()}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(document.createdAt)}
                    </time>
                    <b>Abrir ↗</b>
                  </a>
                  <details className="document-delete-menu">
                    <summary>Excluir</summary>
                    <p className="panel-help">
                      Remover do Hub mantém o arquivo no Google Drive. Excluir
                      do Drive move o arquivo para a lixeira e também remove
                      esta visualização.
                    </p>
                    <div className="document-delete-actions">
                      <form action={deleteGeneratedDocumentAction}>
                        <input
                          type="hidden"
                          name="documentId"
                          value={document.id}
                        />
                        <input type="hidden" name="mode" value="hub" />
                        <button type="submit">Remover só do Hub</button>
                      </form>
                      <form action={deleteGeneratedDocumentAction}>
                        <input
                          type="hidden"
                          name="documentId"
                          value={document.id}
                        />
                        <input type="hidden" name="mode" value="drive" />
                        <button className="danger-button" type="submit">
                          Excluir também do Drive
                        </button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          )}
          {documents.length ? (
            <details className="document-share-panel">
              <summary>Compartilhar documento</summary>
              <form action={setDocumentGroupShareAction}>
                <input type="hidden" name="shared" value="true" />
                <select name="documentId" required>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.name}
                    </option>
                  ))}
                </select>
                <select name="groupId" required>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={!groups.length}>
                  Compartilhar
                </button>
              </form>
              <p className="panel-help">
                O acesso no Hub é imediato. O Google Drive pode exigir
                autorização adicional do proprietário.
              </p>
            </details>
          ) : null}
        </section>
      ) : null}

      {view === "shared" ? (
        <section className="utility-panel document-library">
          <div className="panel-title">
            <span>COMPARTILHADOS COM VOCÊ</span>
            <span>{sharedDocuments.length.toString().padStart(2, "0")}</span>
          </div>
          {sharedDocuments.length === 0 ? (
            <div className="useful-empty">
              <strong>Nenhum documento compartilhado</strong>
              <p>
                Documentos compartilhados pelos seus grupos aparecerão aqui.
              </p>
            </div>
          ) : (
            <ol className="generated-document-list document-cards">
              {sharedDocuments.map((document) => (
                <li key={document.id}>
                  <a
                    href={document.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <strong>{document.name}</strong>
                      <span>{document.subjectName}</span>
                    </div>
                    <small>
                      {document.googlePermissionStatus === "granted"
                        ? "Drive autorizado"
                        : "Acesso Google pode exigir autorização"}
                    </small>
                    <b>Abrir ↗</b>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      {view === "templates" ? (
        <div className="template-manager-layout">
          <section className="utility-panel">
            <div className="panel-title">MODELOS INICIAIS</div>
            <div className="starter-template-list starter-cards">
              {starterDocumentTemplates.map((starter) => (
                <form
                  key={starter.key}
                  action={importStarterDocumentTemplateAction}
                >
                  <input type="hidden" name="starterKey" value={starter.key} />
                  <span>
                    <strong>{starter.name}</strong>
                    <small>{starter.description}</small>
                  </span>
                  <button
                    type="submit"
                    disabled={
                      !driveWriteAvailable ||
                      !configuredStarters.has(starter.key)
                    }
                  >
                    {configuredStarters.has(starter.key)
                      ? "Importar"
                      : "Configuração necessária"}
                  </button>
                </form>
              ))}
            </div>
            <details className="create-template-disclosure">
              <summary>Importar DOCX</summary>
              <form className="workflow-form" action={importDocxTemplateAction}>
                <label>
                  Nome
                  <input name="name" maxLength={120} required />
                </label>
                <label>
                  Tipo do documento
                  <select name="categoryKind" defaultValue="documents">
                    {Object.entries(documentCategoryLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Arquivo DOCX
                  <input
                    name="docx"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                  />
                </label>
                <label className="wide-field">
                  Descrição <small>opcional</small>
                  <input name="description" maxLength={500} />
                </label>
                <input
                  type="hidden"
                  name="namingPattern"
                  value="{{subject.name}} - {{document.title}}"
                />
                <PendingSubmitButton
                  disabled={!driveWriteAvailable}
                  pendingLabel="Importando DOCX…"
                >
                  Importar como Google Docs
                </PendingSubmitButton>
              </form>
            </details>
          </section>

          <section className="utility-panel">
            <div className="panel-title">
              <span>SEUS MODELOS</span>
              <span>{templates.length.toString().padStart(2, "0")}</span>
            </div>
            <details className="create-template-disclosure">
              <summary>+ Criar modelo</summary>
              <form
                className="workflow-form"
                action={createDocumentTemplateAction}
              >
                <label>
                  Nome
                  <input name="name" maxLength={160} required />
                </label>
                <label>
                  Tipo do documento
                  <select name="categoryKind" defaultValue="documents">
                    {Object.entries(documentCategoryLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Nome do arquivo
                  <input
                    name="namingPattern"
                    defaultValue="{{subject.name}} - {{document.title}} - {{document.date}}"
                    maxLength={240}
                    required
                  />
                </label>
                <label className="wide-field">
                  Descrição <small>opcional</small>
                  <input name="description" maxLength={1000} />
                </label>
                <details className="wide-field advanced-settings">
                  <summary>Usar um Google Doc existente</summary>
                  <label>
                    Link do documento base
                    <input
                      id="google-template-source"
                      name="sourceFile"
                      maxLength={2048}
                      placeholder="https://docs.google.com/document/d/…"
                    />
                  </label>
                  <GoogleDocPicker
                    configured={pickerConfigured}
                    inputId="google-template-source"
                  />
                </details>
                <input type="hidden" name="active" value="on" />
                <PendingSubmitButton
                  disabled={!driveWriteAvailable}
                  pendingLabel="Criando modelo…"
                >
                  Criar modelo
                </PendingSubmitButton>
              </form>
            </details>
            {templates.length === 0 ? (
              <div className="useful-empty compact">
                <strong>Nenhum modelo pessoal</strong>
                <p>Importe uma base inicial ou crie uma em branco.</p>
              </div>
            ) : (
              <ol className="template-list template-cards">
                {templates.map((template) => (
                  <li key={template.id}>
                    <Link href={`/documents/templates/${template.id}`}>
                      <div>
                        <strong>{template.name}</strong>
                        <span>{template.description ?? "Modelo pessoal"}</span>
                      </div>
                      <span>
                        {documentCategoryLabels[template.categoryKind]} ·{" "}
                        {template.sections.length} seção(ões) ·{" "}
                        {template.active ? "Ativo" : "Desativado"}
                      </span>
                      <b>Personalizar →</b>
                    </Link>
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
