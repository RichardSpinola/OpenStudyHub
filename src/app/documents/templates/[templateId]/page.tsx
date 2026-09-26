import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DismissibleDetails } from "@/components/dismissible-details";

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
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

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
const documentCategoryLabelsEn: Record<
  keyof typeof documentCategoryLabels,
  string
> = {
  activity: "Activity",
  notes: "Notes",
  documents: "Document",
  custom: "Other",
};

const sectionTypes = [
  ["text", "TEXTO"],
  ["code", "CÓDIGO"],
  ["text_or_image", "TEXTO OU IMAGEM"],
] as const;
const sectionTypeLabelsEn: Record<string, string> = {
  text: "TEXT",
  code: "CODE",
  text_or_image: "TEXT OR IMAGE",
};

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
const placeholderLabelsEn: Record<keyof typeof placeholderLabels, string> = {
  "subject.name": "Subject name",
  "subject.code": "Subject code",
  "program.name": "Program name",
  "program.short_name": "Program short name",
  "period.label": "Period",
  "students.names": "Student names",
  "document.date": "Document date",
  "document.topic": "Entered topic",
  "document.title": "Entered title",
  "document.sections": "Configured sections",
  "activity.title": "Activity name",
  "activity.prompt": "Activity description",
  "instructor.display_name": "Instructor name",
};

function PlaceholderOptions() {
  return (
    <>
      <option value="">
        <UiCopy pt="SEM CONTEÚDO INICIAL" en="NO STARTER CONTENT" />
      </option>
      {canonicalDocumentPlaceholders
        .filter((placeholder) => placeholder !== "document.sections")
        .map((placeholder) => (
          <option key={placeholder} value={placeholder}>
            <UiCopy
              pt={placeholderLabels[placeholder]}
              en={placeholderLabelsEn[placeholder]}
            />
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
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
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
          <p className="eyebrow">
            <UiCopy pt="DOCUMENTOS / MODELOS" en="DOCUMENTS / TEMPLATES" />
          </p>
          <h1>{template.name}</h1>
          <p className="page-description">
            <UiCopy
              pt="Defina as partes do documento. O conteúdo longo será escrito no Google Docs."
              en="Define the document sections. Long content will be written in Google Docs."
            />
          </p>
        </div>
        <Link className="text-link" href="/documents?view=templates">
          <UiCopy pt="← Modelos" en="← Templates" />
        </Link>
      </header>
      {parameters.status?.includes("error") ||
      parameters.status?.startsWith("template-") ? (
        <p className="form-error" role="alert">
          {parameters.status === "template-google-not-connected"
            ? tr(
                "Reconecte sua Conta Google antes de salvar o modelo.",
                "Reconnect your Google Account before saving the template.",
              )
            : parameters.status === "template-template-invalid"
              ? tr(
                  "O documento-base não é um Google Doc válido.",
                  "The source document is not a valid Google Doc.",
                )
              : parameters.status === "template-template-access"
                ? tr(
                    "Sua Conta Google não concedeu acesso a esse documento-base.",
                    "Your Google Account did not grant access to this source document.",
                  )
                : tr("A operação foi recusada.", "The operation was rejected.")}
        </p>
      ) : null}

      <div className="template-builder-layout">
        <section className="utility-panel">
          <div className="panel-title">
            <UiCopy pt="CONFIGURAÇÃO DO MODELO" en="TEMPLATE SETTINGS" />
          </div>
          <form className="workflow-form" action={updateDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <label>
              <UiCopy pt="Nome" en="Name" />
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
              <UiCopy pt="Tipo do documento" en="Document type" />
              <select name="categoryKind" defaultValue={template.categoryKind}>
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
            <label className="wide-field">
              <UiCopy pt="Descrição" en="Description" />
              <input
                name="description"
                defaultValue={template.description ?? ""}
                maxLength={1000}
              />
            </label>
            <label className="wide-field">
              <UiCopy pt="Nome do arquivo" en="File name" />
              <input
                name="namingPattern"
                defaultValue={template.namingPattern}
                maxLength={240}
                required
              />
            </label>
            <details className="wide-field advanced-settings">
              <summary>
                <UiCopy
                  pt="Campos obrigatórios avançados"
                  en="Advanced required fields"
                />
              </summary>
              <fieldset className="option-grid">
                <legend>
                  <UiCopy
                    pt="O documento só será gerado quando houver:"
                    en="The document will only be created when it has:"
                  />
                </legend>
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
                      <UiCopy
                        pt={placeholderLabels[placeholder]}
                        en={placeholderLabelsEn[placeholder]}
                      />
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
              <UiCopy pt="Modelo ativo" en="Active template" />
            </label>
            <button type="submit">
              <UiCopy pt="Salvar modelo" en="Save template" />
            </button>
          </form>
          <div className="panel-actions">
            <a
              className="text-link"
              href={`https://docs.google.com/document/d/${encodeURIComponent(template.sourceFileId)}/edit`}
              target="_blank"
              rel="noreferrer"
            >
              <UiCopy pt="Abrir documento base ↗" en="Open base document ↗" />
            </a>
          </div>
          <form className="clone-form" action={cloneDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <label>
              <UiCopy pt="Nome da cópia" en="Copy name" />
              <input
                name="cloneName"
                defaultValue={tr(
                  `${template.name} — cópia`,
                  `${template.name} — copy`,
                )}
                maxLength={160}
                required
              />
            </label>
            <button type="submit">
              <UiCopy pt="Duplicar modelo" en="Duplicate template" />
            </button>
          </form>
          <form action={deleteDocumentTemplateAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <ConfirmSubmitButton
              className="danger-button"
              type="submit"
              confirmation={tr(
                "Excluir este modelo? Documentos já gerados não serão alterados.",
                "Delete this template? Documents already created will not change.",
              )}
            >
              <UiCopy pt="Excluir modelo" en="Delete template" />
            </ConfirmSubmitButton>
          </form>
        </section>

        <section className="utility-panel">
          <div className="panel-title">
            <UiCopy pt="SEÇÕES DO DOCUMENTO" en="DOCUMENT SECTIONS" />
          </div>
          <p className="panel-help">
            <UiCopy
              pt="Organize a estrutura. As seções opcionais poderão ser escolhidas ao gerar cada documento."
              en="Organize the structure. Optional sections can be chosen when creating each document."
            />
          </p>
          <form
            className="workflow-form section-form"
            action={addDocumentTemplateSectionAction}
          >
            <input type="hidden" name="templateId" value={template.id} />
            <input type="hidden" name="internalKey" value="" />
            <label>
              <UiCopy pt="Título" en="Title" />
              <input name="displayTitle" maxLength={120} required />
            </label>
            <label>
              <UiCopy pt="Tipo" en="Type" />
              <select name="type" defaultValue="text">
                {sectionTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    <UiCopy pt={label} en={sectionTypeLabelsEn[value]} />
                  </option>
                ))}
              </select>
            </label>
            <label>
              <UiCopy pt="Começar com" en="Start with" />
              <select name="initialSource" defaultValue="">
                <PlaceholderOptions />
              </select>
            </label>
            <label className="wide-field">
              <UiCopy pt="Orientação inicial" en="Initial guidance" />
              <input name="helperText" maxLength={500} />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" name="optional" />
              <UiCopy pt="Seção opcional" en="Optional section" />
            </label>
            <button type="submit">
              <UiCopy pt="Adicionar seção" en="Add section" />
            </button>
          </form>

          {template.sections.length === 0 ? (
            <div className="useful-empty compact">
              <strong>
                <UiCopy
                  pt="Nenhuma seção configurada"
                  en="No sections configured"
                />
              </strong>
              <p>
                <UiCopy
                  pt="Adicione a primeira parte do documento acima."
                  en="Add the first section above."
                />
              </p>
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
                      <UiCopy pt="Título" en="Title" />
                      <input
                        name="displayTitle"
                        defaultValue={section.displayTitle}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      <UiCopy pt="Tipo" en="Type" />
                      <select name="type" defaultValue={section.type}>
                        {sectionTypes.map(([value, label]) => (
                          <option key={value} value={value}>
                            <UiCopy
                              pt={label}
                              en={sectionTypeLabelsEn[value]}
                            />
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <UiCopy pt="Começar com" en="Start with" />
                      <select
                        name="initialSource"
                        defaultValue={section.initialSource ?? ""}
                      >
                        <PlaceholderOptions />
                      </select>
                    </label>
                    <label className="wide-field">
                      <UiCopy pt="Orientação inicial" en="Initial guidance" />
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
                      <UiCopy pt="Seção opcional" en="Optional section" />
                    </label>
                    <button type="submit">
                      <UiCopy pt="Salvar seção" en="Save section" />
                    </button>
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
                      <button
                        type="submit"
                        aria-label={tr(
                          "Mover seção para cima",
                          "Move section up",
                        )}
                      >
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
                      <button
                        type="submit"
                        aria-label={tr(
                          "Mover seção para baixo",
                          "Move section down",
                        )}
                      >
                        ↓
                      </button>
                    </form>
                    <DismissibleDetails className="resource-item-actions">
                      <summary
                        aria-label={tr(
                          `Opções da seção ${section.displayTitle}`,
                          `Options for section ${section.displayTitle}`,
                        )}
                      >
                        ⋯
                      </summary>
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
                        <ConfirmSubmitButton
                          className="danger-button"
                          type="submit"
                          confirmation={tr(
                            `Remover a seção ${section.displayTitle} deste modelo?`,
                            `Remove section ${section.displayTitle} from this template?`,
                          )}
                        >
                          <UiCopy pt="Remover seção" en="Remove section" />
                        </ConfirmSubmitButton>
                      </form>
                    </DismissibleDetails>
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
