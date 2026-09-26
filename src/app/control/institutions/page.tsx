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
          <p><UiCopy pt="Escolha a instituição antes de entrar em um curso." en="Choose an institution before opening a course." /></p>
          <AdminActionPanel title="Adicionar instituição">
            <form action={controlAction} className="v2-fields">
              <HiddenContext
                returnTo="/control/institutions"
                intent="institution"
              />
              <label><UiCopy pt="Nome da instituição" en="Institution name" /><input name="name" required minLength={2} />
              </label>
              <button type="submit"><UiCopy pt="Criar instituição" en="Create institution" /></button>
            </form>
          </AdminActionPanel>
        </div>
        <div className="admin-entity-list">
          {institutions.map((item) => (
            <Link
              href={`/control/institutions/${item.id}`}
              key={item.id}
              className="admin-entity-link"
            >
              <strong>{item.name}</strong>
              <span>
                {item.courses}<UiCopy pt="curso(s)" en="course(s)" />{item.archivedAt ? " · Arquivada" : ""}
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </ConsoleShell>
    );
  });
}
