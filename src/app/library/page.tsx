import Link from "next/link";
import { redirect } from "next/navigation";
import { LibraryTypeTabs } from "@/components/library-type-tabs";
import { DocumentLibraryCard } from "@/components/document-library-card";
import { LocalDocumentCard } from "@/components/local-document-card";
import { ProjectLibraryCard } from "@/components/project-library-card";
import DocumentsPage from "../documents/page";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
import {
  listUserGeneratedDocuments,
  listSharedGeneratedDocuments,
  type GeneratedDocumentRecord,
} from "@/lib/document-workflows";
import {
  listLocalDocuments,
  listSharedLocalDocuments,
  type LocalDocument,
} from "@/lib/v2/local-documents";
import { listUserStudyGroups, listVisibleUsers } from "@/lib/collaboration";
import { listUserProjects, type ProjectRecord } from "@/lib/projects";
import {
  filterLibraryItems,
  type LibraryMetadata,
  type LibraryScope,
} from "@/lib/library/filters";
import { uiText } from "@/lib/translations";
export const dynamic = "force-dynamic";
type Item = LibraryMetadata &
  (
    | { kind: "google"; value: GeneratedDocumentRecord }
    | { kind: "local"; value: LocalDocument }
    | { kind: "project"; value: ProjectRecord }
  );
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuthenticatedUser();
  const parameters = await searchParams;
  const query = Object.fromEntries(
    Object.entries(parameters).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const projects = query.type === "projects";
  if (projects && !isProjectsFeatureEnabled()) redirect("/library");
  // Existing creation, templates and callback URLs keep their complete workflows.
  if (
    !projects &&
    query.view &&
    query.view !== "library" &&
    query.view !== "shared"
  )
    return DocumentsPage({ searchParams: Promise.resolve(query) });
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const scope: LibraryScope =
    query.scope === "mine" || query.scope === "shared"
      ? query.scope
      : query.view === "shared"
        ? "shared"
        : "all";
  const layout = query.layout === "list" ? "list" : "grid";
  const search = (query.q ?? "").slice(0, 160);
  const offeringId = /^[1-9]\d*$/.test(query.offeringId ?? "")
    ? Number(query.offeringId)
    : null;
  const groups = projects ? [] : listUserStudyGroups(user.id);
  const people = projects ? [] : listVisibleUsers(user.id);
  let items: Item[] = [];
  if (projects) {
    items = listUserProjects(user.id).map((value) => ({
      kind: "project",
      value,
      name: value.name,
      offeringId: value.offeringId,
      subjectName: value.subjectName,
      updatedAt: value.updatedAt,
      shared: false,
    }));
  } else {
    for (const [records, shared] of [
      [listUserGeneratedDocuments(user.id), false],
      [listSharedGeneratedDocuments(user.id), true],
    ] as const)
      items.push(
        ...records.map((value) => ({
          kind: "google" as const,
          value,
          name: value.name,
          offeringId: value.offeringId,
          subjectName: value.subjectName,
          updatedAt: value.googleModifiedAt ?? value.updatedAt,
          shared,
        })),
      );
    if (process.env.OPENSTUDYHUB_V2_ENABLED === "1") {
      for (const [records, shared] of [
        [listLocalDocuments(user.id), false],
        [listSharedLocalDocuments(user.id), true],
      ] as const)
        items.push(
          ...records.map((value) => ({
            kind: "local" as const,
            value: { ...value, shared },
            name: value.name,
            offeringId: value.offeringId,
            subjectName: value.subjectName,
            updatedAt: value.updatedAt,
            shared,
          })),
        );
    }
  }
  const subjects = new Map(
    items
      .filter((item) => item.offeringId !== null)
      .map((item) => [
        item.offeringId!,
        item.subjectName ?? tr("Disciplina", "Subject"),
      ]),
  );
  const filtered = filterLibraryItems(items, {
    scope,
    query: search,
    offeringId,
  });
  function href(changes: Record<string, string>) {
    const values = new URLSearchParams({
      type: projects ? "projects" : "documents",
      scope,
      layout,
      ...(search ? { q: search } : {}),
      ...(offeringId ? { offeringId: String(offeringId) } : {}),
      ...changes,
    });
    return `/library?${values}`;
  }
  return (
    <div className="workflow-shell resource-workspace library-workspace">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow">
            {tr("ARQUIVOS E TRABALHOS", "FILES AND WORK")}
          </p>
          <h1>{tr("Biblioteca", "Library")}</h1>
          <p className="page-description">
            {tr(
              "Documentos e projetos, com seus conteúdos e os arquivos compartilhados com você.",
              "Documents and projects, including your work and files shared with you.",
            )}
          </p>
        </div>
        <div className="library-heading-actions">
          <Link
            className="secondary-button"
            href={
              projects
                ? "/projects/new?from=projects&mode=import"
                : "/documents?view=library#import-local"
            }
          >
            {tr(
              projects ? "Importar pasta / ZIP" : "Importar arquivo",
              projects ? "Import folder / ZIP" : "Import file",
            )}
          </Link>
          <Link
            className="primary-link"
            href={
              projects
                ? "/projects/new?from=projects&mode=empty"
                : "/documents?view=generate"
            }
          >
            {tr(
              projects ? "+ Novo projeto" : "+ Criar documento",
              projects ? "+ New project" : "+ Create document",
            )}
          </Link>
        </div>
      </header>
      <LibraryTypeTabs kind={projects ? "projects" : "documents"} />
      <div className="library-workspace-layout">
        <aside
          className="library-access-sidebar"
          aria-label={tr("Acesso à biblioteca", "Library access")}
        >
          <h2>{tr("Conteúdos", "Contents")}</h2>
          <nav>
            {(
              [
                ["all", tr("Todos", "All")],
                ["mine", tr("Meus conteúdos", "My contents")],
                ["shared", tr("Compartilhados comigo", "Shared with me")],
              ] as const
            ).map(([id, label]) => (
              <Link
                key={id}
                href={href({ scope: id })}
                aria-current={scope === id ? "page" : undefined}
              >
                <span>{label}</span>
                <small>
                  {
                    items.filter(
                      (item) =>
                        id === "all" || item.shared === (id === "shared"),
                    ).length
                  }
                </small>
              </Link>
            ))}
          </nav>
          {!projects ? (
            <Link
              className="library-templates-link"
              href="/documents?view=templates"
            >
              {tr("Modelos de documento →", "Document templates →")}
            </Link>
          ) : (
            <p className="panel-help">
              {tr(
                "Os projetos são privados. O compartilhamento será ampliado na etapa de arquivos.",
                "Projects are private. Sharing will be expanded in the files stage.",
              )}
            </p>
          )}
        </aside>
        <section
          className="library-collection"
          aria-label={tr(
            projects ? "Projetos" : "Documentos",
            projects ? "Projects" : "Documents",
          )}
        >
          <div className="library-tools">
            <form method="get" action="/library">
              <input
                type="hidden"
                name="type"
                value={projects ? "projects" : "documents"}
              />
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="layout" value={layout} />
              <label>
                <span className="sr-only">
                  {tr("Filtrar pelo nome", "Filter by name")}
                </span>
                <input
                  type="search"
                  name="q"
                  maxLength={160}
                  defaultValue={search}
                  placeholder={tr("Filtrar pelo nome…", "Filter by name…")}
                />
              </label>
              <label>
                <span className="sr-only">
                  {tr("Filtrar disciplina", "Filter subject")}
                </span>
                <select name="offeringId" defaultValue={offeringId ?? ""}>
                  <option value="">
                    {tr("Todas as disciplinas", "All subjects")}
                  </option>
                  {Array.from(subjects).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button>{tr("Filtrar", "Filter")}</button>
            </form>
            <nav
              className="resource-view-toggle"
              aria-label={tr("Visualização da biblioteca", "Library view")}
            >
              <Link
                href={href({ layout: "list" })}
                aria-current={layout === "list" ? "page" : undefined}
              >
                {tr("Lista", "List")}
              </Link>
              <Link
                href={href({ layout: "grid" })}
                aria-current={layout === "grid" ? "page" : undefined}
              >
                {tr("Grade", "Grid")}
              </Link>
            </nav>
          </div>
          <p className="library-results-summary">
            {filtered.length} {tr("item(ns)", "item(s)")} ·{" "}
            {tr(
              projects ? "Projetos" : "Documentos",
              projects ? "Projects" : "Documents",
            )}
            {search || offeringId ? (
              <Link href={href({ q: "", offeringId: "" })}>
                {tr("Limpar filtros", "Clear filters")}
              </Link>
            ) : null}
          </p>
          {filtered.length ? (
            <ul
              className={`${projects ? "project-library-grid" : "document-library-grid"} is-${layout}`}
            >
              {filtered.map((item) =>
                item.kind === "project" ? (
                  <ProjectLibraryCard
                    key={`project:${item.value.id}`}
                    project={item.value}
                    fromProjects
                    language={language}
                  />
                ) : item.kind === "local" ? (
                  <LocalDocumentCard
                    key={`local:${item.value.id}`}
                    document={item.value}
                    ownerUserId={item.shared ? undefined : user.id}
                    people={people}
                    groups={groups}
                    language={language}
                  />
                ) : (
                  <DocumentLibraryCard
                    key={`google:${item.value.id}`}
                    document={item.value}
                    shared={item.shared}
                    people={people}
                    groups={groups}
                    language={language}
                  />
                ),
              )}
            </ul>
          ) : (
            <div className="useful-empty resource-empty">
              <strong>
                {tr(
                  "Nenhum conteúdo nesta seleção",
                  "No content in this selection",
                )}
              </strong>
              <p>
                {tr(
                  search || offeringId
                    ? "Ajuste os filtros para encontrar seus arquivos."
                    : scope === "shared"
                      ? "Os conteúdos que compartilharem com você aparecerão aqui."
                      : "Crie ou importe seu primeiro conteúdo usando as ações acima.",
                  search || offeringId
                    ? "Adjust the filters to find your files."
                    : scope === "shared"
                      ? "Content shared with you will appear here."
                      : "Create or import your first item using the actions above.",
                )}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
