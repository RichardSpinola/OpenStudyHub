import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { ConsoleShell, HiddenContext } from "../ui";
import { AdminActionPanel } from "../admin-action-panel";
import { controlAction } from "../actions";

export default async function Institutions({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const institutions = db
      .prepare(
        `SELECT i.id,i.name,i.archived_at archivedAt,
        (SELECT count(*) FROM programs p WHERE p.institution_id=i.id AND p.archived_at IS NULL) courses
       FROM institutions i ORDER BY i.name`,
      )
      .all() as Array<{
      id: number;
      name: string;
      archivedAt: number | null;
      courses: number;
    }>;
    return (
      <ConsoleShell
        title="Instituições"
        kicker="ADMINISTRAÇÃO / INSTITUIÇÕES"
        name={actor.name}
        admin
        active="institutions"
        message={q.ok}
        error={q.error}
      >
        <div className="admin-section-header">
          <p>
            <UiCopy
              pt="Escolha a instituição antes de entrar em um curso."
              en="Choose an institution before opening a course."
            />
          </p>
          <AdminActionPanel title="Adicionar instituição">
            <form action={controlAction} className="v2-fields">
              <HiddenContext
                returnTo="/control/institutions"
                intent="institution"
              />
              <label>
                <UiCopy pt="Nome da instituição" en="Institution name" />
                <input name="name" required minLength={2} />
              </label>
              <button type="submit">
                <UiCopy pt="Criar instituição" en="Create institution" />
              </button>
            </form>
          </AdminActionPanel>
        </div>
        <div className="admin-portal-grid">
          {institutions.map((item) => (
            <Link
              href={`/control/institutions/${item.id}`}
              key={item.id}
              className="admin-portal-card"
            >
              <strong>{item.name}</strong>
              <span>
                {item.courses}{" "}
                <UiCopy
                  pt={item.courses === 1 ? "curso" : "cursos"}
                  en={item.courses === 1 ? "course" : "courses"}
                />
                {item.archivedAt ? " · Arquivada" : ""}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
        <details className="admin-secondary-tools">
          <summary>Trazer dados de uma instalação antiga</summary>
          <p>
            Use esta opção somente para atualizar uma instalação com dados V1.
            Uma instalação nova não precisa de importação.
          </p>
          <Link href="/control/import">
            Revisar importação de estrutura V1 →
          </Link>
        </details>
      </ConsoleShell>
    );
  });
}
