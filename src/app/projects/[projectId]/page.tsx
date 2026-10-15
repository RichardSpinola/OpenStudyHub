import { getDriveAccessPolicy } from "@/lib/drive-access-policy";
import { subjectResourceHref } from "@/lib/v2/academic-links";
import { ProjectSharingPanel } from "@/components/project-sharing-panel";
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
  suggestProjectLanguage,
  suggestProjectTechnologies,
} from "@/lib/project-manifest";
import {
  getProjectDriveStorageUser,
  getProjectSyncFailureStage,
  getProjectRetryPreview,
  getUserProject,
  listProjectFiles,
  listProjectVersions,
  projectPreviewDiff,
} from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; from?: string; area?: string }>;
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
  const directDriveAccess =
    project.storageBackend === "google-drive" &&
    getDriveAccessPolicy() === "direct" &&
    getProjectDriveStorageUser(project) === user.id;
  const status = parameters.status;
  const isOwner = project.ownerUserId === user.id;
  const failureStage =
    status === "sync-error" ? getProjectSyncFailureStage(project.id) : null;
  const retryPreview = isOwner
    ? getProjectRetryPreview(user.id, project.id)
    : null;
  const returnHref =
    parameters.from === "projects" || project.subjectId === null
      ? "/library?type=projects"
      : subjectResourceHref(
          user.id,
          project.offeringId,
          project.subjectId,
          "projects",
        );
  const returnLabel =
    parameters.from === "projects" || project.subjectId === null
      ? tr("← Meus projetos", "← My projects")
      : `← ${project.subjectName}`;
  const dateFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div
      className={`workflow-shell project-detail-shell ${isOwner ? "" : "project-read-only"}`}
    >
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

      {!isOwner ? (
        <p className="feedback-banner">
          <UiCopy
            pt="Compartilhado com você para leitura e download."
            en="Shared with you for reading and download."
          />
        </p>
      ) : null}
      {status === "shared" ? (
        <p role="status">
          <UiCopy
            pt="Acesso ao projeto atualizado."
            en="Project access updated."
          />
        </p>
      ) : status === "share-error" ? (
        <p role="alert">
          <UiCopy
            pt="Não foi possível compartilhar. Confira a pessoa escolhida."
            en="Could not share. Check the selected person."
          />
        </p>
      ) : null}
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
          <UiCopy pt="Nova versão salva." en="New version saved." />
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

      <div className="project-context-strip">
        <span>
          {project.storageBackend === "local"
            ? tr("Arquivos nesta instância", "Files in this instance")
            : "Google Drive"}
        </span>
        <span>
          {files.length} {tr("arquivos", "files")}
        </span>
        <span>
          {tr("Atualizado", "Updated")}{" "}
          {dateFormatter.format(project.updatedAt)}
        </span>
      </div>
      {project.description && <p>{project.description}</p>}
      <nav
        className="resource-workspace-tabs"
        aria-label={tr("Áreas do projeto", "Project areas")}
      >
        {(isOwner
          ? ["files", "versions", "sharing", "settings"]
          : ["files", "versions"]
        ).map((a) => (
          <Link
            key={a}
            href={`?area=${a}`}
            aria-current={
              (parameters.area ?? "files") === a ? "page" : undefined
            }
          >
            {
              {
                files: tr("Arquivos", "Files"),
                versions: tr("Versões", "Versions"),
                sharing: tr("Compartilhar", "Share"),
                settings: tr("Configurações", "Settings"),
              }[a]
            }
          </Link>
        ))}
      </nav>
      {(parameters.area ?? "files") === "files" && (
        <>
          <div className="project-detail-grid" id="files">
            {isOwner ? (
              <ProjectUpload
                key={project.id}
                projectId={project.id}
                currentVersionNumber={project.currentVersionNumber}
                currentLanguage={project.language}
                currentTechnologies={project.technologies}
                initialPreview={
                  retryPreview
                    ? {
                        token: retryPreview.token,
                        files: JSON.parse(retryPreview.manifestJson).files
                          .length,
                        diff: projectPreviewDiff(user.id, retryPreview.token),
                        ignored: JSON.parse(retryPreview.ignoredJson),
                        suggestedLanguage: suggestProjectLanguage(
                          JSON.parse(retryPreview.manifestJson).files,
                        ),
                        suggestedTechnologies: suggestProjectTechnologies(
                          JSON.parse(retryPreview.manifestJson).files,
                        ),
                      }
                    : undefined
                }
              />
            ) : (
              <section className="utility-panel">
                <h2>
                  <UiCopy pt="Arquivos e versões" en="Files and versions" />
                </h2>
                <p>
                  <UiCopy
                    pt="Abra uma versão abaixo para visualizar ou baixar os arquivos compartilhados."
                    en="Open a version below to preview or download shared files."
                  />
                </p>
              </section>
            )}
          </div>

          <section
            className="utility-panel project-file-browser"
            aria-label={tr("Arquivos da versão atual", "Current version files")}
          >
            <div className="panel-title">
              <UiCopy
                pt="ARQUIVOS · VERSÃO ATUAL"
                en="FILES · CURRENT VERSION"
              />
            </div>
            {files.length === 0 ? (
              <p>
                <UiCopy
                  pt="Nenhum arquivo sincronizado ainda."
                  en="No files synced yet."
                />
              </p>
            ) : (
              <ProjectFileBrowser
                projectId={project.id}
                files={files}
                directDriveAccess={directDriveAccess}
                currentVersionNumber={project.currentVersionNumber}
              />
            )}
          </section>
        </>
      )}
      {parameters.area === "versions" && (
        <>
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
                  <UiCopy
                    pt="Nenhuma versão enviada"
                    en="No version uploaded"
                  />
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
                    <span
                      className="project-version-marker"
                      aria-hidden="true"
                    />
                    <div className="project-version-main">
                      <strong>
                        v{String(version.versionNumber).padStart(4, "0")}
                      </strong>
                      <span>
                        {version.message ??
                          tr("Sem descrição", "No description")}
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
        </>
      )}
      {parameters.area === "sharing" && isOwner && (
        <>
          {isOwner && process.env.OPENSTUDYHUB_V2_ENABLED === "1" ? (
            <ProjectSharingPanel projectId={project.id} ownerId={user.id} />
          ) : null}
          {project.storageBackend === "google-drive" && (
            <section
              className="utility-panel project-sharing-panel"
              id="sharing"
            >
              <div>
                <p className="eyebrow">
                  <UiCopy pt="COMPARTILHAMENTO" en="SHARING" />
                </p>
                <h2>
                  {directDriveAccess ? (
                    <UiCopy
                      pt="Compartilhe pelo Drive"
                      en="Share through Drive"
                    />
                  ) : (
                    <UiCopy pt="Drive da instituição" en="Institution Drive" />
                  )}
                </h2>
                <p>
                  {directDriveAccess ? (
                    <UiCopy
                      pt="As permissões dos arquivos são controladas no Google Drive. Abra a pasta do projeto para escolher quem pode acessá-la."
                      en="File permissions are controlled in Google Drive. Open the project folder to choose who can access it."
                    />
                  ) : (
                    <UiCopy
                      pt="Seus arquivos ficam no Drive da instituição. Você pode visualizar e baixar as versões aqui no OpenStudyHub; o acesso direto à pasta depende do administrador."
                      en="Your files are stored in the institution Drive. View and download versions here in OpenStudyHub; direct folder access depends on the administrator."
                    />
                  )}
                </p>
              </div>
              {directDriveAccess && project.driveProjectFolderId ? (
                <a
                  className="primary-link"
                  href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <UiCopy
                    pt="Abrir pasta no Drive ↗"
                    en="Open folder in Drive ↗"
                  />
                </a>
              ) : !project.driveProjectFolderId ? (
                <span className="project-sharing-pending">
                  <UiCopy
                    pt="A pasta aparecerá após a primeira sincronização."
                    en="The folder will appear after the first sync."
                  />
                </span>
              ) : null}
            </section>
          )}
        </>
      )}
      {parameters.area === "settings" && isOwner && (
        <div className="project-settings-workspace">
          {" "}
          <aside className="utility-panel project-summary-panel">
            <div className="panel-title">
              <UiCopy pt="ARMAZENAMENTO" en="STORAGE" />
            </div>
            <dl className="subject-meta-list">
              <div>
                <dt>
                  {project.storageBackend === "local"
                    ? "Nesta instância"
                    : "Google Drive"}
                </dt>
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
              <form
                action={updateProjectTechnologyAction}
                className="stack-form"
              >
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
            {directDriveAccess && project.driveProjectFolderId ? (
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
                  pt="Remove o projeto das listas locais. Os arquivos e versões são preservados. Você poderá restaurar este projeto."
                  en="Removes the project from local lists. Files and versions are kept. You can restore this project."
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
      )}
    </div>
  );
}
