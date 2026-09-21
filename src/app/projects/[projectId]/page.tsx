import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveProjectAction } from "@/app/projects/actions";
import { ProjectUpload } from "@/components/project-upload";
import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  projectLanguageLabels,
  projectTechnologyLabels,
} from "@/lib/project-manifest";
import { getUserProject, listProjectVersions } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const rawId = (await params).projectId;
  if (!/^\d+$/.test(rawId)) notFound();
  let project;
  let versions;
  try {
    project = getUserProject(user.id, Number(rawId));
    versions = listProjectVersions(user.id, project.id);
  } catch {
    notFound();
  }
  const status = (await searchParams).status;
  const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="workflow-shell project-detail-shell">
      <header className="section-header">
        <div>
          <p className="eyebrow">
            PROJETO · {project.subjectCode ?? project.subjectName}
          </p>
          <h1>{project.name}</h1>
          <p className="page-description">
            {project.technologies.length
              ? project.technologies
                  .map((item) => projectTechnologyLabels[item])
                  .join(" · ")
              : projectLanguageLabels[project.language]}{" "}
            · versão {project.currentVersionNumber || "inicial"}
          </p>
        </div>
        <Link href={`/subjects/${project.subjectId}?view=projects`}>
          ← {project.subjectName}
        </Link>
      </header>

      {status === "synced" ? (
        <p className="feedback-banner is-success" role="status">
          Nova versão sincronizada com o Drive.
        </p>
      ) : status === "conflict" ? (
        <p className="feedback-banner is-error" role="alert">
          Existe uma versão mais recente. Baixe a atual antes de tentar
          novamente.
        </p>
      ) : status === "sync-error" ? (
        <p className="feedback-banner is-error" role="alert">
          A sincronização não foi concluída. Os metadados locais não foram
          marcados como completos; tente novamente.
        </p>
      ) : null}

      <div className="project-detail-grid">
        <ProjectUpload
          projectId={project.id}
          currentVersionNumber={project.currentVersionNumber}
        />
        <aside className="utility-panel project-summary-panel">
          <div className="panel-title">ESTADO</div>
          <dl className="subject-meta-list">
            <div>
              <dt>Drive</dt>
              <dd>
                {
                  {
                    prepared: "Aguardando primeira versão",
                    syncing: "Sincronizando",
                    complete: "Sincronizado",
                    failed: "Sincronização pendente",
                  }[project.syncStatus]
                }
              </dd>
            </div>
            <div>
              <dt>Atualizado</dt>
              <dd>{dateFormatter.format(project.updatedAt)}</dd>
            </div>
            <div>
              <dt>Ignore</dt>
              <dd>{projectLanguageLabels[project.ignorePreset]}</dd>
            </div>
            <div>
              <dt>Tecnologias / Stack</dt>
              <dd>
                {project.technologies.length
                  ? project.technologies
                      .map((item) => projectTechnologyLabels[item])
                      .join(", ")
                  : projectLanguageLabels[project.language]}
              </dd>
            </div>
          </dl>
          {project.driveProjectFolderId ? (
            <a
              className="primary-link"
              href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no Drive ↗
            </a>
          ) : null}
          <details className="danger-zone">
            <summary>Arquivar projeto</summary>
            <p className="panel-help">
              Remove o projeto das listas locais. Os arquivos no Drive não são
              apagados.
            </p>
            <form action={archiveProjectAction}>
              <input type="hidden" name="projectId" value={project.id} />
              <button type="submit" className="danger-button">
                Arquivar localmente
              </button>
            </form>
          </details>
        </aside>
      </div>

      <section className="utility-panel project-history" id="versions">
        <div className="panel-title">VERSÕES</div>
        {versions.length === 0 ? (
          <div className="useful-empty compact">
            <strong>Nenhuma versão enviada</strong>
            <p>Selecione a pasta ou um ZIP para criar v0001.</p>
          </div>
        ) : (
          <ol className="version-list">
            {versions.map((version) => (
              <li key={version.id}>
                <div>
                  <strong>
                    v{String(version.versionNumber).padStart(4, "0")}
                  </strong>
                  <span>{version.message ?? "Sem descrição"}</span>
                </div>
                <span>
                  +{version.addedCount} ~{version.modifiedCount} −
                  {version.removedCount}
                </span>
                <time>{dateFormatter.format(version.createdAt)}</time>
                <a
                  href={`/api/projects/${project.id}/versions/${version.versionNumber}/download`}
                >
                  Baixar ZIP
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
