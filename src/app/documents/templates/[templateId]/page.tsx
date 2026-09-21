import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addDocumentTemplateSectionAction,
  cloneDocumentTemplateAction,
  deleteDocumentTemplateAction,
  deleteDocumentTemplateSectionAction,
  moveDocumentTemplateSectionAction,
  updateDocumentTemplateAction,
  updateDocumentTemplateSectionAction,
} from "@/app/documents/actions";
import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  canonicalDocumentPlaceholders,
  getUserDocumentTemplate,
} from "@/lib/document-templates";

export const dynamic = "force-dynamic";

type TemplatePageProps = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ status?: string }>;
};

const documentCategoryLabels = {
  activity: "Atividade",
  notes: "Anotações",
  documents: "Documento",
  custom: "Outro",
} as const;

const sectionTypes = [
  ["text", "TEXTO"],
  ["code", "CÓDIGO"],
  ["text_or_image", "TEXTO OU IMAGEM"],
] as const;

const placeholderLabels = {
  "subject.name": "Nome da matéria",
  "subject.code": "Código da matéria",
  "program.name": "Nome do curso",
  "program.short_name": "Sigla do curso",
  "period.label": "Período",
  "students.names": "Nome dos alunos",
  "document.date": "Data do documento",
  "document.topic": "Tema informado",
  "document.title": "Título informado",
  "document.sections": "Seções configuradas",
  "activity.title": "Nome da atividade",
  "activity.prompt": "Descrição da atividade",
  "instructor.display_name": "Nome do professor",
} as const;

function PlaceholderOptions() {
  return (
    <>
      <option value="">SEM CONTEÚDO INICIAL</option>
      {canonicalDocumentPlaceholders
        .filter((placeholder) => placeholder !== "document.sections")
        .map((placeholder) => (
          <option key={placeholder} value={placeholder}>
            {placeholderLabels[placeholder]}
          </option>
        ))}
    </>
  );
}

export default async function DocumentTemplatePage({
  params,
  searchParams,
}: TemplatePageProps) {
  const user = await requireAuthenticatedUser();
  const rawId = (await params).templateId;
  if (!/^\d+$/.test(rawId)) notFound();
  const templateId = Number(rawId);
  let template;
  try {
    template = getUserDocumentTemplate(user.id, templateId);
  } catch {
    notFound();
  }
  const parameters = await searchParams;

  return (
    <div className="workflow-shell template-builder-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">DOCUMENTOS / MODELOS</p>
          <h1>{template.name}</h1>
          <p className="page-description">
            Defina as partes do documento. O conteúdo longo será escrito no
            Google Docs.
          </p>
        </div>
        <Link className="text-link" href="/documents">
          ← Modelos
        </Link>
      </header>
      {parameters.status?.includes("error") ||
      parameters.status?.startsWith("template-") ? (
        <p className="form-error" role="alert">
          {parameters.status === "template-google-not-connected"
            ? "Reconecte sua Conta Google antes de salvar o modelo."
            : parameters.status === "template-template-invalid"
              ? "O documento-base não é um Google Doc válido."
              : parameters.status === "template-template-access"
                ? "Sua Conta Google não concedeu acesso a esse documento-base."
                : "A operação foi recusada."}
        </p>
      ) : null}

      <div className="template-builder-layout">
        <section className="utility-panel">
          <div className="panel-title">CONFIGURAÇÃO DO MODELO</div>
          <form className="workflow-form" action={updateDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <label>
              Nome
              <input
                name="name"
                defaultValue={template.name}
                maxLength={160}
                required
              />
            </label>
            <input
              type="hidden"
              name="sourceFile"
              value={template.sourceFileId}
            />
            <label>
              Tipo do documento
              <select name="categoryKind" defaultValue={template.categoryKind}>
                {Object.entries(documentCategoryLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="wide-field">
              Descrição
              <input
                name="description"
                defaultValue={template.description ?? ""}
                maxLength={1000}
              />
            </label>
            <label className="wide-field">
              Nome do arquivo
              <input
                name="namingPattern"
                defaultValue={template.namingPattern}
                maxLength={240}
                required
              />
            </label>
            <details className="wide-field advanced-settings">
              <summary>Campos obrigatórios avançados</summary>
              <fieldset className="option-grid">
                <legend>O documento só será gerado quando houver:</legend>
                {canonicalDocumentPlaceholders
                  .filter((placeholder) => placeholder !== "document.sections")
                  .map((placeholder) => (
                    <label key={placeholder}>
                      <input
                        type="checkbox"
                        name="requiredPlaceholders"
                        value={placeholder}
                        defaultChecked={template.requiredPlaceholders.includes(
                          placeholder,
                        )}
                      />
                      {placeholderLabels[placeholder]}
                    </label>
                  ))}
              </fieldset>
            </details>
            <label className="checkbox-field wide-field">
              <input
                type="checkbox"
                name="active"
                defaultChecked={template.active}
              />
              Modelo ativo
            </label>
            <button type="submit">Salvar modelo</button>
          </form>
          <div className="panel-actions">
            <a
              className="text-link"
              href={`https://docs.google.com/document/d/${encodeURIComponent(template.sourceFileId)}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir documento base ↗
            </a>
          </div>
          <form className="clone-form" action={cloneDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <label>
              Nome da cópia
              <input
                name="cloneName"
                defaultValue={`${template.name} — cópia`}
                maxLength={160}
                required
              />
            </label>
            <button type="submit">Duplicar modelo</button>
          </form>
          <form action={deleteDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <button className="danger-button" type="submit">
              Excluir modelo
            </button>
          </form>
        </section>

        <section className="utility-panel">
          <div className="panel-title">SEÇÕES DO DOCUMENTO</div>
          <p className="panel-help">
            Organize a estrutura. As seções opcionais poderão ser escolhidas ao
            gerar cada documento.
          </p>
          <form
            className="workflow-form section-form"
            action={addDocumentTemplateSectionAction}
          >
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="internalKey" value="" />
            <label>
              Título
              <input name="displayTitle" maxLength={120} required />
            </label>
            <label>
              Tipo
              <select name="type" defaultValue="text">
                {sectionTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Começar com
              <select name="initialSource" defaultValue="">
                <PlaceholderOptions />
              </select>
            </label>
            <label className="wide-field">
              Orientação inicial
              <input name="helperText" maxLength={500} />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" name="optional" /> Seção opcional
            </label>
            <button type="submit">Adicionar seção</button>
          </form>

          {template.sections.length === 0 ? (
            <div className="useful-empty compact">
              <strong>Nenhuma seção configurada</strong>
              <p>Adicione a primeira parte do documento acima.</p>
            </div>
          ) : (
            <ol className="builder-section-list">
              {template.sections.map((section, index) => (
                <li key={section.id}>
                  <div className="section-row-title">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.displayTitle}</strong>
                    <span>{section.type}</span>
                  </div>
                  <form
                    className="workflow-form section-form"
                    action={updateDocumentTemplateSectionAction}
                  >
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <input type="hidden" name="sectionId" value={section.id} />
                    <input
                      type="hidden"
                      name="internalKey"
                      value={section.internalKey}
                    />
                    <label>
                      Título
                      <input
                        name="displayTitle"
                        defaultValue={section.displayTitle}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Tipo
                      <select name="type" defaultValue={section.type}>
                        {sectionTypes.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Começar com
                      <select
                        name="initialSource"
                        defaultValue={section.initialSource ?? ""}
                      >
                        <PlaceholderOptions />
                      </select>
                    </label>
                    <label className="wide-field">
                      Orientação inicial
                      <input
                        name="helperText"
                        defaultValue={section.helperText ?? ""}
                        maxLength={500}
                      />
                    </label>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        name="optional"
                        defaultChecked={section.optional}
                      />
                      Seção opcional
                    </label>
                    <button type="submit">Salvar seção</button>
                  </form>
                  <div className="section-controls">
                    <form action={moveDocumentTemplateSectionAction}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <input
                        type="hidden"
                        name="sectionId"
                        value={section.id}
                      />
                      <input type="hidden" name="direction" value="up" />
                      <button type="submit" aria-label="Mover seção para cima">
                        ↑
                      </button>
                    </form>
                    <form action={moveDocumentTemplateSectionAction}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <input
                        type="hidden"
                        name="sectionId"
                        value={section.id}
                      />
                      <input type="hidden" name="direction" value="down" />
                      <button type="submit" aria-label="Mover seção para baixo">
                        ↓
                      </button>
                    </form>
                    <form action={deleteDocumentTemplateSectionAction}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <input
                        type="hidden"
                        name="sectionId"
                        value={section.id}
                      />
                      <button className="danger-button" type="submit">
                        REMOVER
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
