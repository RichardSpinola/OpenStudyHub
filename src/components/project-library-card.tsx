import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { DocumentOptionsDialog } from "./document-options-dialog";
import { ProjectDeleteForm } from "./project-delete-form";
import { archiveProjectAction } from "@/app/projects/actions";

import {
  projectLanguageLabels,
  projectTechnologyLabels,
} from "@/lib/project-manifest";
import type { ProjectRecord } from "@/lib/projects";
import type { UiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

const syncLabels = {
  prepared: "Aguardando envio",
  syncing: "Sincronizando",
  complete: "No Drive",
  failed: "Ação necessária",
} as const;

export function ProjectLibraryCard({
  project,
  fromProjects = false,
  language = "pt-BR",
  currentUserId,
}: {
  project: ProjectRecord;
  fromProjects?: boolean;
  language?: UiLanguage;
  currentUserId?: number;
}) {
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const subjectName =
    project.offeringId === null
      ? tr("Projeto pessoal", "Personal project")
      : project.subjectName;
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
  }).format(project.updatedAt);
  const stack = project.technologies.length
    ? project.technologies.map((item) => projectTechnologyLabels[item])
    : [projectLanguageLabels[project.language]];
  const href = `/projects/${project.id}${fromProjects ? "?from=projects" : ""}`;

  return (
    <li className="project-library-card">
      <div className="project-card-visual" aria-hidden="true">
        <span className="project-visual-glyph">{"{ }"}</span>
        <span>{project.subjectCode ?? subjectName}</span>
        <strong>
          {project.currentVersionNumber
            ? `v${String(project.currentVersionNumber).padStart(4, "0")}`
            : tr("Novo projeto", "New project")}
        </strong>
      </div>
      <div className="project-card-content">
        <span className="project-card-context">{subjectName}</span>
        <h3>{project.name}</h3>
        <p>
          {project.description ||
            tr(
              "Arquivos e versões deste projeto em um só lugar.",
              "Project files and versions in one place.",
            )}
        </p>
        <div
          className="project-stack"
          aria-label={tr("Tecnologias", "Technologies")}
        >
          {stack.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
          {stack.length > 4 ? <span>+{stack.length - 4}</span> : null}
        </div>
        <div className="project-card-meta">
          <span>
            {tr(
              project.syncStatus === "complete" &&
                project.storageBackend === "local"
                ? "Salvo nesta instância"
                : syncLabels[project.syncStatus],
              {
                prepared: "Awaiting upload",
                syncing: "Syncing",
                complete:
                  project.storageBackend === "local"
                    ? "Saved locally"
                    : "In Drive",
                failed: "Action required",
              }[project.syncStatus],
            )}
          </span>
          <time dateTime={new Date(project.updatedAt).toISOString()}>
            {date}
          </time>
        </div>
        <div className="project-card-actions">
          <Link className="primary-link" href={href}>
            <UiCopy pt="Abrir projeto →" en="Open project →" />
          </Link>
          <DocumentOptionsDialog name={project.name} kind="PROJETO">
            <nav className="project-options-links">
              <Link
                href={`${href}${href.includes("?") ? "&" : "?"}area=versions`}
              >
                {tr("Ver versões", "View versions")}
              </Link>
              {currentUserId === project.ownerUserId && (
                <Link
                  href={`${href}${href.includes("?") ? "&" : "?"}area=sharing`}
                >
                  {tr("Compartilhamento", "Sharing")}
                </Link>
              )}
              {project.currentVersionNumber > 0 && (
                <a
                  href={`/api/projects/${project.id}/versions/${project.currentVersionNumber}/download`}
                >
                  {tr("Baixar versão atual", "Download current version")}
                </a>
              )}
            </nav>
            {currentUserId === project.ownerUserId && (
              <>
                <form action={archiveProjectAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button>{tr("Arquivar projeto", "Archive project")}</button>
                  <small>
                    {tr(
                      "Oculta da Biblioteca e permite restaurar depois.",
                      "Hides from the Library and can be restored later.",
                    )}
                  </small>
                </form>
                <ProjectDeleteForm
                  id={project.id}
                  name={project.name}
                  storageBackend={project.storageBackend}
                />
              </>
            )}
          </DocumentOptionsDialog>
        </div>
      </div>
    </li>
  );
}
