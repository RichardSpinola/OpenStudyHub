import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  archiveProjectAction,
  confirmProjectUploadAction,
  updateProjectTechnologyAction,
} from "@/app/projects/actions";
import { ProjectUpload } from "@/components/project-upload";
import { ProjectSyncSubmit } from "@/components/project-sync-submit";
import { ProjectTechnologyPicker } from "@/components/project-technology-picker";
import { ProjectFileBrowser } from "@/components/project-file-browser";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";
import {
  projectLanguageLabels,
  projectLanguages,
  projectTechnologyLabels,
} from "@/lib/project-manifest";
import {
  getProjectSyncFailureStage,
  getProjectRetryPreview,
  getUserProject,
  listProjectFiles,
  listProjectVersions,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; from?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const rawId = (await params).projectId;
  if (!/^\d+$/.test(rawId)) notFound();
  let project;
  let versions;
  let files;
  try {
    project = getUserProject(user.id, Number(rawId));
    versions = listProjectVersions(user.id, project.id);
    files = listProjectFiles(user.id, project.id);
  } catch {
    notFound();
  }
  const parameters = await searchParams;
  const status = parameters.status;
  const failureStage =
    status === "sync-error" ? getProjectSyncFailureStage(project.id) : null;
  const retryPreview =
    status === "sync-error"
      ? getProjectRetryPreview(user.id, project.id)
      : null;
  const returnHref =
    parameters.from === "projects"
      ? "/projects"
      : `/subjects/${project.subjectId}?view=projects`;
  const returnLabel =
    parameters.from === "projects"
      ? tr("← Meus projetos", "← My projects")
      : `← ${project.subjectName}`;
  const dateFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="workflow-shell project-detail-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">
            <UiCopy pt="PROJETO" en="PROJECT" /> ·{" "}
            {project.subjectCode ?? project.subjectName}
          </p>
          <h1>{project.name}</h1>
          <p className="page-description">
            {project.technologies.length
              ? project.technologies
                  .map((item) => projectTechnologyLabels[item])
                  .join(" · ")
              : projectLanguageLabels[project.language]}{" "}
            · <UiCopy pt="versão" en="version" />{" "}
            {project.currentVersionNumber || tr("inicial", "initial")}
          </p>
        </div>
        <Link href={returnHref}>{returnLabel}</Link>
      </header>

      {status === "created" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy
            pt="Projeto criado. Selecione uma pasta ou ZIP abaixo; você pode corrigir as sugestões antes de sincronizar."
            en="Project created. Select a folder or ZIP below; you can adjust suggestions before syncing."
          />
        </p>
      ) : status === "empty" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy
            pt="Projeto vazio criado. Você pode importar arquivos depois."
            en="Empty project created. You can import files later."
          />
        </p>
      ) : status === "technology-saved" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy pt="Tecnologias atualizadas." en="Technologies updated." />
        </p>
      ) : status === "technology-error" ? (
        <p className="feedback-banner is-error" role="alert">
          <UiCopy
            pt="Não foi possível atualizar as tecnologias."
            en="Technologies could not be updated."
          />
        </p>
      ) : status === "synced" ? (
        <p className="feedback-banner is-success" role="status">
          <UiCopy
            pt="Nova versão sincronizada com o Drive."
            en="New version synced to Drive."
          />
        </p>
      ) : status === "conflict" ? (
        <p className="feedback-banner is-error" role="alert">
          <UiCopy
            pt="Existe uma versão mais recente. Baixe a atual antes de tentar novamente."
            en="A newer version exists. Download the current one before trying again."
          />
        </p>
      ) : status === "preview-expired" ? (
        <p className="feedback-banner is-error" role="alert">
          <UiCopy
            pt="A prévia do envio venceu ou não está mais disponível. Selecione a pasta ou o ZIP novamente; nenhuma versão foi alterada."
            en="The upload preview expired or is no longer available. Select the folder or ZIP again; no version was changed."
          />
        </p>
      ) : status === "sync-error" ? (
        <div className="feedback-banner is-error" role="alert">
          {failureStage ? (
            <p>
              <UiCopy
                pt="A sincronização parou na etapa:"
                en="Sync stopped at stage:"
              />{" "}
              {failureStage}.{" "}
              <UiCopy
                pt="Nenhuma nova versão foi marcada como concluída."
                en="No new version was marked complete."
              />
            </p>
          ) : (
            <p>
              <UiCopy
                pt="Este aviso veio de uma tentativa anterior, que não registrou a causa. A versão atual do projeto é"
                en="This notice came from an earlier attempt that did not record the cause. The current project version is"
              />{" "}
              {project.currentVersionNumber || tr("nenhuma", "none")};{" "}
              <UiCopy
                pt="confira os arquivos antes de fazer outro envio."
                en="check the files before uploading again."
              />
            </p>
          )}
          {retryPreview ? (
            <form action={confirmProjectUploadAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <input type="hidden" name="token" value={retryPreview.token} />
              <input type="hidden" name="language" value={project.language} />
              <ProjectSyncSubmit retry />
            </form>
          ) : (
            <p>
              <UiCopy
                pt="Não há uma prévia de retry vinculada a esta tentativa. Selecione a pasta ou o ZIP novamente."
                en="No retry preview is linked to this attempt. Select the folder or ZIP again."
              />
            </p>
          )}
        </div>
      ) : null}

      <section
        className="project-overview"
        id="overview"
        aria-label={tr("Visão geral do projeto", "Project overview")}
      >
        <div className="project-overview-art" aria-hidden="true">
          <span>{"{ }"}</span>
          <strong>{project.subjectCode ?? project.subjectName}</strong>
        </div>
        <div className="project-overview-copy">
          <p className="eyebrow">
            <UiCopy pt="VISÃO GERAL" en="OVERVIEW" />
          </p>
          <h2>{project.name}</h2>
          <p>
            {project.description ||
              tr(
                "Arquivos e versões deste projeto organizados em um só lugar.",
                "Project files and versions organized in one place.",
              )}
          </p>
          <div className="project-overview-facts">
            <span>
              <UiCopy pt="Versão" en="Version" />{" "}
              {project.currentVersionNumber
                ? `v${String(project.currentVersionNumber).padStart(4, "0")}`
                : tr("inicial", "initial")}
            </span>
            <span>{project.subjectName}</span>
            <span>
              <UiCopy pt="Atualizado" en="Updated" />{" "}
              {dateFormatter.format(project.updatedAt)}
            </span>
          </div>
        </div>
      </section>

      <div className="project-detail-grid" id="files">
        <ProjectUpload
          projectId={project.id}
          currentVersionNumber={project.currentVersionNumber}
          currentLanguage={project.language}
          currentTechnologies={project.technologies}
        />
        <aside className="utility-panel project-summary-panel">
          <div className="panel-title">
            <UiCopy pt="ARMAZENAMENTO" en="STORAGE" />
          </div>
          <dl className="subject-meta-list">
            <div>
              <dt>Drive</dt>
              <dd>
                {
                  {
                    prepared: tr(
                      "Aguardando primeira versão",
                      "Awaiting first version",
                    ),
                    syncing: tr("Sincronizando", "Syncing"),
                    complete: tr("Sincronizado", "Synced"),
                    failed: tr("Sincronização pendente", "Sync pending"),
                  }[project.syncStatus]
                }
              </dd>
            </div>
            <div>
              <dt>
                <UiCopy pt="Atualizado" en="Updated" />
              </dt>
              <dd>{dateFormatter.format(project.updatedAt)}</dd>
            </div>
            <div>
              <dt>
                <UiCopy
                  pt="Arquivos excluídos do pacote"
                  en="Files excluded from package"
                />
              </dt>
              <dd>{projectLanguageLabels[project.ignorePreset]}</dd>
            </div>
            <div>
              <dt>
                <UiCopy pt="Tecnologias / Stack" en="Technologies / Stack" />
              </dt>
              <dd>
                {project.technologies.length
                  ? project.technologies
                      .map((item) => projectTechnologyLabels[item])
                      .join(", ")
                  : projectLanguageLabels[project.language]}
              </dd>
            </div>
          </dl>
          <details className="project-technology-edit">
            <summary>
              <UiCopy
                pt="Editar linguagem e stack"
                en="Edit language and stack"
              />
            </summary>
            <form action={updateProjectTechnologyAction} className="stack-form">
              <input type="hidden" name="projectId" value={project.id} />
              <label>
                <UiCopy pt="Linguagem principal" en="Primary language" />
                <select name="language" defaultValue={project.language}>
                  {projectLanguages.map((language) => (
                    <option key={language} value={language}>
                      {projectLanguageLabels[language]}
                    </option>
                  ))}
                </select>
              </label>
              <ProjectTechnologyPicker initial={project.technologies} />
              <button type="submit">
                <UiCopy pt="Salvar tecnologias" en="Save technologies" />
              </button>
            </form>
          </details>
          {project.driveProjectFolderId ? (
            <a
              className="primary-link"
              href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
              target="_blank"
              rel="noreferrer"
            >
              <UiCopy pt="Abrir no Drive ↗" en="Open in Drive ↗" />
            </a>
          ) : null}
          <details className="danger-zone">
            <summary>
              <UiCopy pt="Arquivar projeto" en="Archive project" />
            </summary>
            <p className="panel-help">
              <UiCopy
                pt="Remove o projeto das listas locais. Os arquivos no Drive não são apagados."
                en="Removes the project from local lists. Drive files are not deleted."
              />
            </p>
            <form action={archiveProjectAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <ConfirmSubmitButton
                type="submit"
                className="danger-button"
                confirmation={tr(
                  "Arquivar este projeto? Os arquivos armazenados permanecerão intactos.",
                  "Archive this project? Stored files will remain intact.",
                )}
              >
                <UiCopy pt="Arquivar localmente" en="Archive locally" />
              </ConfirmSubmitButton>
            </form>
          </details>
        </aside>
      </div>

      <section
        className="utility-panel project-file-browser"
        aria-label={tr("Arquivos da versão atual", "Current version files")}
      >
        <div className="panel-title">
          <UiCopy pt="ARQUIVOS · VERSÃO ATUAL" en="FILES · CURRENT VERSION" />
        </div>
        {files.length === 0 ? (
          <p>
            <UiCopy
              pt="Nenhum arquivo sincronizado ainda."
              en="No files synced yet."
            />
          </p>
        ) : (
          <ProjectFileBrowser projectId={project.id} files={files} />
        )}
      </section>

      <section className="utility-panel project-history" id="versions">
        <div className="project-section-heading">
          <div>
            <p className="eyebrow">
              <UiCopy pt="HISTÓRICO" en="HISTORY" />
            </p>
            <h2>
              <UiCopy pt="Versões do projeto" en="Project versions" />
            </h2>
            <p>
              <UiCopy
                pt="Compare as mudanças antes de confirmar uma nova versão na área de arquivos."
                en="Compare changes before confirming a new version in the file area."
              />
            </p>
          </div>
          <span>
            {versions.length}{" "}
            {versions.length === 1
              ? tr("versão", "version")
              : tr("versões", "versions")}
          </span>
        </div>
        {versions.length === 0 ? (
          <div className="useful-empty compact">
            <strong>
              <UiCopy pt="Nenhuma versão enviada" en="No version uploaded" />
            </strong>
            <p>
              <UiCopy
                pt="Selecione a pasta ou um ZIP para criar v0001."
                en="Select a folder or ZIP to create v0001."
              />
            </p>
          </div>
        ) : (
          <ol className="version-list">
            {versions.map((version) => (
              <li key={version.id}>
                <span className="project-version-marker" aria-hidden="true" />
                <div className="project-version-main">
                  <strong>
                    v{String(version.versionNumber).padStart(4, "0")}
                  </strong>
                  <span>
                    {version.message ?? tr("Sem descrição", "No description")}
                  </span>
                  <time>{dateFormatter.format(version.createdAt)}</time>
                </div>
                <span className="project-version-diff">
                  +{version.addedCount} ~{version.modifiedCount} −
                  {version.removedCount}
                </span>
                <a
                  href={`/api/projects/${project.id}/versions/${version.versionNumber}/download`}
                >
                  <UiCopy pt="Baixar ZIP" en="Download ZIP" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="utility-panel project-sharing-panel" id="sharing">
        <div>
          <p className="eyebrow">
            <UiCopy pt="COMPARTILHAMENTO" en="SHARING" />
          </p>
          <h2>
            <UiCopy pt="Compartilhe pelo Drive" en="Share through Drive" />
          </h2>
          <p>
            <UiCopy
              pt="As permissões dos arquivos são controladas no Google Drive. Abra a pasta do projeto para escolher quem pode acessá-la."
              en="File permissions are controlled in Google Drive. Open the project folder to choose who can access it."
            />
          </p>
        </div>
        {project.driveProjectFolderId ? (
          <a
            className="primary-link"
            href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
            target="_blank"
            rel="noreferrer"
          >
            <UiCopy pt="Abrir pasta no Drive ↗" en="Open folder in Drive ↗" />
          </a>
        ) : (
          <span className="project-sharing-pending">
            <UiCopy
              pt="A pasta aparecerá após a primeira sincronização."
              en="The folder will appear after the first sync."
            />
          </span>
        )}
      </section>
    </div>
  );
}
