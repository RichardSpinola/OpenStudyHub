import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";

import { ProjectLibraryCard } from "@/components/project-library-card";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listUserProjects, type ProjectRecord } from "@/lib/projects";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const layout = (await searchParams).layout === "list" ? "list" : "grid";
  let projects: ProjectRecord[];
  try {
    projects = listUserProjects(user.id);
  } catch {
    return (
      <div className="workflow-shell">
        <p role="alert"><UiCopy pt="Não foi possível carregar seus projetos agora." en="Your projects could not be loaded right now." /></p>
      </div>
    );
  }
  return (
    <div className="workflow-shell projects-index resource-workspace">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow"><UiCopy pt="SEU TRABALHO EM VERSÕES" en="YOUR WORK, VERSIONED" /></p>
          <h1><UiCopy pt="Meus projetos" en="My projects" /></h1>
          <p className="page-description"><UiCopy pt="Acompanhe arquivos, alterações e versões de cada projeto das suas disciplinas." en="Follow the files, changes and versions of each subject project." /></p>
        </div>
        <Link className="primary-link" href="/projects/new?from=projects"><UiCopy pt="+ Novo projeto" en="+ New project" /></Link>
      </header>
      <section
        className="resource-collection"
        aria-labelledby="project-list-title"
      >
        <div className="resource-collection-header">
          <div>
            <span className="page-kicker"><UiCopy pt="BIBLIOTECA" en="LIBRARY" /></span>
            <h2 id="project-list-title"><UiCopy pt="Todos os projetos" en="All projects" /><small>{projects.length}</small>
            </h2>
          </div>
          <nav
            className="resource-view-toggle"
            aria-label={uiText(language, "Visualização dos projetos", "Project view")}
          >
            <Link
              href="/projects?layout=grid"
              aria-current={layout === "grid" ? "page" : undefined}
            >
              <UiCopy pt="Grade" en="Grid" />
            </Link>
            <Link
              href="/projects?layout=list"
              aria-current={layout === "list" ? "page" : undefined}
            ><UiCopy pt="Lista" en="List" />
            </Link>
          </nav>
        </div>
        {projects.length ? (
          <ul className={`project-library-grid is-${layout}`}>
            {projects.map((project) => (
              <ProjectLibraryCard
                key={project.id}
                project={project}
                fromProjects
                language={language}
              />
            ))}
          </ul>
        ) : (
          <div className="useful-empty resource-empty">
            <strong><UiCopy pt="Comece seu primeiro projeto" en="Start your first project" /></strong>
            <p><UiCopy pt="Escolha a disciplina, crie o projeto e envie uma pasta ou um ZIP." en="Choose a subject, create a project and upload a folder or ZIP." /></p>
            <Link href="/projects/new?from=projects"><UiCopy pt="Criar projeto →" en="Create project →" /></Link>
          </div>
        )}
      </section>
    </div>
  );
}
