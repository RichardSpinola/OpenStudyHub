import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { controlAction } from "./actions";
import { ConsoleShell, HiddenContext, Help } from "./ui";
export default async function Control({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    if (isSetupPending(db)) redirect("/control/setup");
    const user = await currentAdminV2(db);
    if (!user) redirect("/control/login");
    if (user.mustChangePassword) redirect("/control/password");
    const institutions = db
      .prepare("SELECT id,name,archived_at FROM institutions ORDER BY name")
      .all() as Array<{ id: number; name: string; archived_at: number | null }>;
    const programs = db
      .prepare(
        "SELECT p.id,p.name,p.code,p.institution_id,p.archived_at,COUNT(c.id) cohorts FROM programs p LEFT JOIN cohorts c ON c.program_id=p.id AND c.archived_at IS NULL GROUP BY p.id ORDER BY p.name",
      )
      .all() as Array<{
      id: number;
      name: string;
      code: string;
      institution_id: number;
      cohorts: number;
      archived_at: number | null;
    }>;
    const totals = {
      users: (
        db.prepare("SELECT count(*) n FROM users WHERE active=1").get() as {
          n: number;
        }
      ).n,
      planned: (
        db
          .prepare(
            "SELECT count(*) n FROM cohort_periods WHERE state='planned'",
          )
          .get() as { n: number }
      ).n,
    };
    return (
      <ConsoleShell
        title="Admin da instância"
        kicker="OpenStudyHub · control plane"
        name={user.name}
        admin
        message={q.ok}
        error={q.error}
      >
        <p>
          Visão por instituição e curso. Escolha um curso para administrar sua
          estrutura, horários e matrículas.
        </p>
        <div className="v2-note" role="status">
          {totals.users} usuários ativos · {totals.planned} períodos preparados
        </div>
        {institutions.map((i) => (
          <section key={i.id}>
            <h2>
              {i.name} {i.archived_at ? "· Arquivada" : ""}
            </h2>
            <div className="v2-actions">
              <details>
                <summary>Editar instituição</summary>
                <form action={controlAction} className="v2-fields">
                  <HiddenContext
                    returnTo="/control"
                    intent="edit"
                    entity="institutions"
                    id={i.id}
                  />
                  <label>
                    Nome
                    <input name="name" defaultValue={i.name} required />
                  </label>
                  <button>Salvar</button>
                </form>
              </details>
              <form action={controlAction}>
                <HiddenContext
                  returnTo="/control"
                  intent="lifecycle"
                  entity="institutions"
                  id={i.id}
                  operation={i.archived_at ? "reactivate" : "archive"}
                />
                <button>{i.archived_at ? "Reativar" : "Arquivar"}</button>
              </form>
            </div>
            <div className="v2-list">
              {programs
                .filter((p) => p.institution_id === i.id)
                .map((p) => (
                  <div className="v2-row" key={p.id}>
                    <div>
                      <strong>{p.name}</strong>{" "}
                      <span className="v2-muted">
                        {p.code} · {p.cohorts} turmas{" "}
                        {p.archived_at ? "· Arquivado" : ""}
                      </span>
                    </div>
                    {!p.archived_at ? (
                      <Link
                        href={`/control/academics?program=${p.id}&section=structure`}
                      >
                        Administrar curso →
                      </Link>
                    ) : null}
                    <details>
                      <summary>Editar curso</summary>
                      <form action={controlAction} className="v2-fields">
                        <HiddenContext
                          returnTo="/control"
                          intent="edit"
                          entity="programs"
                          id={p.id}
                        />
                        <label>
                          Código
                          <input name="code" defaultValue={p.code} required />
                        </label>
                        <label>
                          Nome
                          <input name="name" defaultValue={p.name} required />
                        </label>
                        <button>Salvar</button>
                      </form>
                    </details>
                    <form action={controlAction}>
                      <HiddenContext
                        returnTo="/control"
                        intent="lifecycle"
                        entity="programs"
                        id={p.id}
                        operation={p.archived_at ? "reactivate" : "archive"}
                      />
                      <button>{p.archived_at ? "Reativar" : "Arquivar"}</button>
                    </form>
                  </div>
                ))}
            </div>
            <details>
              <summary>Adicionar curso</summary>
              <form action={controlAction} className="v2-fields">
                <HiddenContext
                  returnTo="/control"
                  intent="program"
                  institutionId={i.id}
                />
                <label>
                  Código
                  <input name="code" required />
                </label>
                <label>
                  Nome do curso
                  <input name="name" required />
                </label>
                <button>Criar curso</button>
              </form>
            </details>
          </section>
        ))}
        <details>
          <summary>Adicionar instituição</summary>
          <form action={controlAction} className="v2-fields">
            <HiddenContext returnTo="/control" intent="institution" />
            <label>
              Nome
              <input name="name" required />
            </label>
            <button>Criar instituição</button>
          </form>
        </details>
        <Help>
          Admin controla a instância e também pode usar a área Gestão. Um gestor
          delegado vê apenas os cursos e capacidades que recebeu.
        </Help>
      </ConsoleShell>
    );
  });
}
