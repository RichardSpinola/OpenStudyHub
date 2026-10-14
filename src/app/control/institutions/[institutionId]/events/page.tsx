import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentAdminV2, withV2DbAsync } from "@/lib/v2/runtime";
import { ConsoleShell } from "@/app/control/ui";
import { EventsPanel } from "@/app/control/events-panel";
export default async function Events({
  params,
  searchParams,
}: {
  params: Promise<{ institutionId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const id = Number((await params).institutionId),
    q = await searchParams;
  return withV2DbAsync(async (db) => {
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const institution = db
      .prepare("SELECT name FROM institutions WHERE id=?")
      .get(id) as { name: string } | undefined;
    if (!institution) notFound();
    return (
      <ConsoleShell
        title={institution.name}
        kicker="EVENTOS E PROVAS"
        name={actor.name}
        admin
        active="institutions"
        message={q.ok}
        error={q.error}
      >
        <nav aria-label="Caminho" className="admin-context-links">
          <Link href="/control/institutions">Instituições</Link> /{" "}
          <Link href={`/control/institutions/${id}`}>{institution.name}</Link> /
          Eventos e provas
        </nav>
        {EventsPanel({
          db: db,
          actor: actor,
          institutionId: id,
          returnTo: "/control/institutions/" + id + "/events",
        })}
      </ConsoleShell>
    );
  });
}
