import { ProjectDeleteForm } from "@/components/project-delete-form";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listArchivedProjects } from "@/lib/projects";
import { restoreProjectAction } from "../actions";
export default async function ArchivedProjects() {
  const user = await requireAuthenticatedUser(),
    projects = listArchivedProjects(user.id);
  return (
    <div className="workflow-shell">
      <header className="section-header">
        <h1>Projetos arquivados</h1>
        <Link href="/library?type=projects">← Voltar à Biblioteca</Link>
      </header>
      <p>
        Seus arquivos e versões foram preservados. Restaurar devolve o projeto à
        Biblioteca.
      </p>
      <div className="resource-grid">
        {projects.map((p) => (
          <article className="utility-panel" key={p.id}>
            <h2>{p.name}</h2>
            <p>
              {p.currentVersionNumber} versão(ões) ·{" "}
              {p.storageBackend === "local"
                ? "Nesta instância"
                : "Google Drive"}
            </p>
            <form action={restoreProjectAction}>
              <input type="hidden" name="projectId" value={p.id} />
              <button>Restaurar projeto</button>
            </form>
            <ProjectDeleteForm
              id={p.id}
              name={p.name}
              storageBackend={p.storageBackend}
            />
          </article>
        ))}
      </div>
      {!projects.length && <p>Nenhum projeto arquivado.</p>}
    </div>
  );
}
