import Link from "next/link";
import { requireToolUser } from "@/lib/authorization";
import { getUserProfile } from "@/lib/profile";
import { personalPlanningContext } from "@/lib/personal-planning-context";
import { listPersonalTasks } from "@/lib/personal-tasks";
import { PersonalTasks } from "@/components/personal-tasks";
import { uiText } from "@/lib/translations";
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireToolUser(),
    profile = getUserProfile(user.id),
    ctx = personalPlanningContext(user.id),
    q = await searchParams;
  const tr = (pt: string, en: string) => uiText(profile.locale, pt, en);
  return (
    <div className="academic-shell personal-planning-page">
      <header className="academic-heading">
        <div>
          <Link href="/today">{tr("← Hoje", "← Today")}</Link>
          <p className="system-label">
            {tr("SEU PLANEJAMENTO", "YOUR PLANNING")}
          </p>
          <h1>{tr("Minhas tarefas", "My tasks")}</h1>
          <p>
            {tr(
              "Organize seus estudos. Estas tarefas são privadas e não alteram entregas do Classroom.",
              "Organize your studies. These tasks are private and do not change Classroom submissions.",
            )}
          </p>
        </div>
      </header>
      <PersonalTasks
        tasks={listPersonalTasks(user.id)}
        timeZone={ctx.timeZone}
        offerings={ctx.offerings.map((o) => ({
          key: o.key,
          label: `${o.subjectName} · ${o.periodLabel}`,
        }))}
        initiallyOpen={q.new === "1"}
      />
    </div>
  );
}
