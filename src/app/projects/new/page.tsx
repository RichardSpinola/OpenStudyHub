import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";

import { createProjectAction } from "@/app/projects/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { listUserSubjectOfferings } from "@/lib/academic";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{
    offeringId?: string;
    from?: string;
    error?: string;
  }>;
}) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const query = await searchParams;
  const offerings = listUserSubjectOfferings(user.id);
  const selected = offerings.find(
    ({ offeringId }) => String(offeringId) === query.offeringId,
  );
  const fromProjects = query.from === "projects";
  const returnHref =
    !fromProjects && selected
      ? `/subjects/${selected.subjectId}?view=projects`
      : "/projects";

  return (
    <div className="workflow-shell project-create-shell">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow">
            <UiCopy pt="PROJETOS" en="PROJECTS" />
          </p>
          <h1>
            <UiCopy pt="Novo projeto" en="New project" />
          </h1>
          <p className="page-description">
            <UiCopy
              pt="Dê um nome e escolha a disciplina. Depois importe uma pasta ou ZIP, ou comece com o projeto vazio."
              en="Name the project and choose a subject. Then import a folder or ZIP, or start with an empty project."
            />
          </p>
        </div>
        <Link href={returnHref}>
          <UiCopy pt="← Voltar" en="← Back" />
        </Link>
      </header>

      {!offerings.length ? (
        <div className="useful-empty" role="status">
          <strong>
            <UiCopy
              pt="Nenhuma disciplina disponível"
              en="No subjects available"
            />
          </strong>
          <p>
            <UiCopy
              pt="Você precisa estar matriculado em uma disciplina para criar um projeto."
              en="You must be enrolled in a subject to create a project."
            />
          </p>
          <Link href="/subjects">
            <UiCopy pt="Ver disciplinas →" en="View subjects →" />
          </Link>
        </div>
      ) : (
        <section
          className="utility-panel project-create-panel"
          aria-labelledby="project-create-title"
        >
          <div className="project-create-heading">
            <h2 id="project-create-title">
              <UiCopy pt="Dados do projeto" en="Project details" />
            </h2>
            <span>
              <UiCopy
                pt="1 de 2 · depois, escolha os arquivos"
                en="1 of 2 · choose files next"
              />
            </span>
          </div>
          {query.error ? (
            <p className="feedback-banner is-error" role="alert">
              <UiCopy
                pt="Não foi possível criar o projeto. Confira os campos e tente novamente."
                en="The project could not be created. Check the fields and try again."
              />
            </p>
          ) : null}
          <form
            action={createProjectAction}
            className="workflow-form project-create-form"
          >
            <input
              type="hidden"
              name="from"
              value={fromProjects ? "projects" : "subject"}
            />
            <label>
              <UiCopy pt="Disciplina" en="Subject" />
              <select
                name="offeringId"
                defaultValue={selected?.offeringId ?? offerings[0].offeringId}
                required
              >
                {offerings.map((offering) => (
                  <option key={offering.offeringId} value={offering.offeringId}>
                    {offering.subjectName} · {offering.periodLabel}
                    {offering.classGroup ? ` · ${offering.classGroup}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <UiCopy pt="Nome do projeto" en="Project name" />
              <input
                name="name"
                maxLength={160}
                placeholder={uiText(
                  language,
                  "Ex.: Trabalho de programação",
                  "E.g. Programming assignment",
                )}
                required
                autoFocus
              />
            </label>
            <div className="project-create-actions">
              <Link href={returnHref}>
                <UiCopy pt="Cancelar" en="Cancel" />
              </Link>
              <PendingSubmitButton
                pendingLabel={
                  <UiCopy pt="Criando projeto…" en="Creating project…" />
                }
              >
                <UiCopy pt="Criar e importar →" en="Create and import →" />
              </PendingSubmitButton>
              <button
                type="submit"
                name="start"
                value="empty"
                className="secondary-button"
              >
                <UiCopy pt="Começar vazio" en="Start empty" />
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
