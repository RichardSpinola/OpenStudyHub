import { subjectResourceHref } from "@/lib/v2/academic-links";
import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";

import { createProjectAction } from "@/app/projects/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { listUserSubjectOfferings } from "@/lib/academic";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export default async function ProjectCreateWorkspace({
  searchParams,
}: {
  searchParams: Promise<{
    offeringId?: string;
    from?: string;
    error?: string;
    mode?: string;
  }>;
}) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const query = await searchParams;
  const offerings = listUserSubjectOfferings(user.id);
  const selected = offerings.find(
    ({ offeringId }) => String(offeringId) === query.offeringId,
  );
  const explicitMode =
    query.mode === "empty" || query.mode === "import" ? query.mode : null;
  const fromProjects = query.from === "projects";
  const returnHref =
    !fromProjects && selected
      ? subjectResourceHref(
          user.id,
          selected.offeringId,
          selected.subjectId,
          "projects",
        )
      : "/library?type=projects";

  return (
    <div className="project-create-workspace">
      <header className="section-header resource-page-header">
        <div>
          <p className="eyebrow">
            <UiCopy pt="PROJETOS" en="PROJECTS" />
          </p>
          <h2>
            {explicitMode === "import" ? (
              <UiCopy pt="Importar projeto" en="Import project" />
            ) : (
              <UiCopy pt="Novo projeto" en="New project" />
            )}
          </h2>
          <p className="page-description">
            <UiCopy
              pt="Dê um nome ao projeto. A disciplina é opcional. Comece vazio ou importe uma pasta ou ZIP."
              en="Name the project. The subject is optional. Start empty or import a folder or ZIP."
            />
          </p>
        </div>
        <Link href={returnHref}>
          <UiCopy pt="← Voltar" en="← Back" />
        </Link>
      </header>

      <section
        className="utility-panel project-create-panel"
        aria-labelledby="project-create-title"
      >
        <div className="project-create-heading">
          <h2 id="project-create-title">
            <UiCopy pt="Dados do projeto" en="Project details" />
          </h2>
          <span>
            {explicitMode === "empty" ? (
              <UiCopy
                pt="Comece sem arquivos; você pode adicioná-los depois."
                en="Start without files; you can add them later."
              />
            ) : (
              <UiCopy
                pt="1 de 2 · depois, escolha os arquivos"
                en="1 of 2 · choose files next"
              />
            )}
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
            <UiCopy pt="Disciplina (opcional)" en="Subject (optional)" />
            <select name="offeringId" defaultValue={selected?.offeringId ?? ""}>
              <option value="">
                <UiCopy
                  pt="Projeto pessoal · sem disciplina"
                  en="Personal project · no subject"
                />
              </option>
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
          <label>
            <UiCopy pt="Descrição (opcional)" en="Description (optional)" />
            <textarea name="description" maxLength={1000} rows={3} />
          </label>
          <div className="project-create-actions">
            <Link href={returnHref}>
              <UiCopy pt="Cancelar" en="Cancel" />
            </Link>
            {explicitMode === "empty" ? (
              <input type="hidden" name="start" value="empty" />
            ) : null}
            <PendingSubmitButton
              pendingLabel={
                <UiCopy pt="Criando projeto…" en="Creating project…" />
              }
            >
              {explicitMode === "empty" ? (
                <UiCopy
                  pt="Criar projeto vazio →"
                  en="Create empty project →"
                />
              ) : (
                <UiCopy pt="Criar e importar →" en="Create and import →" />
              )}
            </PendingSubmitButton>
            {!explicitMode ? (
              <button
                type="submit"
                name="start"
                value="empty"
                className="secondary-button"
              >
                <UiCopy pt="Começar vazio" en="Start empty" />
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
