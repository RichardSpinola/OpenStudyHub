import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
const collections = [
  {
    entity: "subjects",
    title: "Disciplinas",
    intent: "subject",
    fields: ["name", "code"],
  },
  {
    entity: "academic_periods",
    title: "Períodos letivos",
    intent: "period",
    fields: ["label", "startsOn", "endsOn"],
  },
  {
    entity: "instructors",
    title: "Professores",
    intent: "instructor",
    fields: ["name"],
  },
  {
    entity: "locations",
    title: "Salas",
    intent: "location",
    fields: ["name", "campus", "room"],
  },
] as const;
const labels: Record<string, string> = {
  name: "Nome",
  code: "Código",
  label: "Período (ex.: 2030.1)",
  startsOn: "Início",
  endsOn: "Fim",
  campus: "Campus",
  room: "Número da sala",
};
export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; institution?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const user = await currentAdminV2(db);
    if (!user) redirect("/control/login");
    if (user.mustChangePassword) redirect("/control/password");
    const institutions = db
      .prepare(
        "SELECT id,name FROM institutions WHERE archived_at IS NULL ORDER BY name",
      )
      .all() as Array<{ id: number; name: string }>;
    const selected =
      institutions.find((x) => x.id === Number(q.institution)) ??
      institutions[0];
    const returnTo = selected
      ? `/control/catalog?institution=${selected.id}`
      : "/control/catalog";
    return (
      <ConsoleShell
        title="Cadastros da instância"
        kicker="Admin · catálogos por instituição"
        name={user.name}
        admin
        message={q.ok}
        error={q.error}
      >
        <p>
          Cadastros da instituição selecionada, compartilhados apenas entre seus
          cursos. Use o curso para vincular disciplinas ao currículo e criar
          ofertas.
        </p>
        <nav className="v2-tabs" aria-label="Instituição dos catálogos">
          {institutions.map((i) => (
            <Link
              key={i.id}
              href={`/control/catalog?institution=${i.id}`}
              aria-current={i.id === selected?.id ? "page" : undefined}
            >
              {i.name}
            </Link>
          ))}
        </nav>
        {!selected ? (
          <p>Crie uma instituição antes de cadastrar catálogos.</p>
        ) : null}
        <Help>
          Arquivar retira da seleção futura, preservando histórico. Excluir só é
          permitido se não houver vínculos.
        </Help>
        {selected
          ? collections.map((c) => {
              const list = db
                .prepare(
                  `SELECT *,${c.entity === "academic_periods" ? "label" : "name"} display_name FROM ${c.entity} WHERE institution_id=? ORDER BY id DESC`,
                )
                .all(selected.id) as Array<{
                id: number;
                display_name: string;
                archived_at: number | null;
                name?: string;
                code?: string;
                label?: string;
                starts_on?: string;
                ends_on?: string;
                campus?: string;
                room?: string;
              }>;
              return (
                <section key={c.entity}>
                  <h2>{c.title}</h2>
                  <details>
                    <summary>Adicionar</summary>
                    <form action={controlAction} className="v2-fields">
                      <HiddenContext
                        returnTo={returnTo}
                        intent={c.intent}
                        institutionId={selected.id}
                      />
                      {c.fields.map((field) => (
                        <label key={field}>
                          {labels[field]}
                          <input
                            name={field}
                            type={field.endsWith("On") ? "date" : "text"}
                            required={
                              field !== "code" &&
                              field !== "campus" &&
                              field !== "room"
                            }
                          />
                        </label>
                      ))}
                      <button>Salvar</button>
                    </form>
                  </details>
                  <div className="v2-list">
                    {list.map((row) => (
                      <div className="v2-row" key={row.id}>
                        <span>
                          {row.display_name}{" "}
                          {row.archived_at ? "· Arquivado" : ""}
                        </span>
                        <details>
                          <summary>Editar</summary>
                          <form action={controlAction} className="v2-fields">
                            <HiddenContext
                              returnTo={returnTo}
                              intent="edit"
                              entity={c.entity}
                              id={row.id}
                            />
                            {c.fields.map((field) => (
                              <label key={field}>
                                {labels[field]}
                                <input
                                  name={field}
                                  type={field.endsWith("On") ? "date" : "text"}
                                  defaultValue={String(
                                    field === "startsOn"
                                      ? (row.starts_on ?? "")
                                      : field === "endsOn"
                                        ? (row.ends_on ?? "")
                                        : (row[field as keyof typeof row] ??
                                          ""),
                                  )}
                                  required={
                                    field !== "code" &&
                                    field !== "campus" &&
                                    field !== "room"
                                  }
                                />
                              </label>
                            ))}
                            <button>Salvar alterações</button>
                          </form>
                        </details>
                        <form action={controlAction}>
                          <HiddenContext
                            returnTo={returnTo}
                            intent="lifecycle"
                            entity={c.entity}
                            id={row.id}
                            operation={
                              row.archived_at ? "reactivate" : "archive"
                            }
                          />
                          <button>
                            {row.archived_at ? "Reativar" : "Arquivar"}
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })
          : null}
      </ConsoleShell>
    );
  });
}
