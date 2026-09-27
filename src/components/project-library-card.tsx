import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { DismissibleDetails } from "@/components/dismissible-details";

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
}: {
  project: ProjectRecord;
  fromProjects?: boolean;
  language?: UiLanguage;
}) {
  const tr = (pt: string, en: string) => uiText(language, pt, en);
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
        <span>{project.subjectCode ?? project.subjectName}</span>
        <strong>
          {project.currentVersionNumber
            ? `v${String(project.currentVersionNumber).padStart(4, "0")}`
            : tr("Novo projeto", "New project")}
        </strong>
      </div>
      <div className="project-card-content">
        <span className="project-card-context">{project.subjectName}</span>
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
              syncLabels[project.syncStatus],
              {
                prepared: "Awaiting upload",
                syncing: "Syncing",
                complete: "In Drive",
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
          {project.currentVersionNumber > 0 || project.driveProjectFolderId ? (
            <DismissibleDetails className="resource-item-actions">
              <summary
                aria-label={tr(
                  `Mais opções para ${project.name}`,
                  `More options for ${project.name}`,
                )}
              >
                ⋯
              </summary>
              <div>
                <Link href={`${href}#versions`}>
                  <UiCopy pt="Ver versões" en="View versions" />
                </Link>
                {project.currentVersionNumber > 0 ? (
                  <a
                    href={`/api/projects/${project.id}/versions/${project.currentVersionNumber}/download`}
                  >
                    <UiCopy
                      pt="Baixar versão atual"
                      en="Download current version"
                    />
                  </a>
                ) : null}
                {project.driveProjectFolderId ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${encodeURIComponent(project.driveProjectFolderId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <UiCopy pt="Abrir no Drive ↗" en="Open in Drive ↗" />
                  </a>
                ) : null}
              </div>
            </DismissibleDetails>
          ) : null}
        </div>
      </div>
    </li>
  );
}
