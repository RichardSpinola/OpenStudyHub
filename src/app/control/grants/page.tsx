import { GrantForm } from "./grant-form";
import { UiCopy } from "@/components/ui-language-provider";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
import { AdminActionPanel } from "../admin-action-panel";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";
const capabilityLabel: Record<string, [string, string]> = {
  manage_academics: ["Gestor acadêmico", "Academic manager"],
  manage_cohort: ["Gerenciar turmas e períodos", "Manage cohorts and periods"],
  manage_schedule: ["Gerenciar horários", "Manage schedules"],
  manage_enrollments: ["Gerenciar matrículas", "Manage enrollments"],
  moderate_chat: ["Moderar conversa", "Moderate chat"],
};
export default async function Grants({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const language = getUiLanguage();
    const tr = (pt: string, en: string) => uiText(language, pt, en);
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const users = db
      .prepare(
        "SELECT id,display_name name FROM users WHERE active=1 ORDER BY display_name",
      )
      .all() as Array<{ id: number; name: string }>;
    const programs = db
      .prepare(
        "SELECT p.id,i.name || ' / ' || p.name name FROM programs p JOIN institutions i ON i.id=p.institution_id WHERE p.archived_at IS NULL AND i.archived_at IS NULL ORDER BY i.name,p.name",
      )
      .all() as Array<{ id: number; name: string }>;
    const institutions = db
      .prepare(
        "SELECT id,name FROM institutions WHERE archived_at IS NULL ORDER BY name",
      )
      .all() as Array<{ id: number; name: string }>;
    const cohorts = db
      .prepare(
        "SELECT c.id,i.name || ' / ' || p.name || ' / ' || c.name name FROM cohorts c JOIN programs p ON p.id=c.program_id JOIN institutions i ON i.id=p.institution_id WHERE c.archived_at IS NULL AND p.archived_at IS NULL AND i.archived_at IS NULL ORDER BY i.name,p.name,c.name",
      )
      .all() as Array<{ id: number; name: string }>;
    const offerings = db
      .prepare(
        "SELECT o.id,i.name || ' / ' || p.name || ' / ' || s.name || ' · ' || ap.label || coalesce(' · ' || nullif(o.class_group,''),'') || coalesce(' · ' || sh.name,'') name FROM offerings o JOIN programs p ON p.id=o.program_id JOIN institutions i ON i.id=p.institution_id JOIN subjects s ON s.id=o.subject_id JOIN academic_periods ap ON ap.id=o.period_id LEFT JOIN shifts sh ON sh.id=o.shift_id WHERE o.archived_at IS NULL AND p.archived_at IS NULL AND i.archived_at IS NULL ORDER BY i.name,p.name,s.name",
      )
      .all() as Array<{ id: number; name: string }>;
    const grants = db
      .prepare(
        "SELECT g.id,u.display_name user,g.capability,COALESCE(i.name,p.name,c.name,s.name) scope FROM permission_grants g JOIN users u ON u.id=g.user_id LEFT JOIN institutions i ON i.id=g.institution_id LEFT JOIN programs p ON p.id=g.program_id LEFT JOIN cohorts c ON c.id=g.cohort_id LEFT JOIN offerings o ON o.id=g.offering_id LEFT JOIN subjects s ON s.id=o.subject_id WHERE g.revoked_at IS NULL ORDER BY g.id DESC",
      )
      .all() as Array<{
      id: number;
      user: string;
      capability: string;
      scope: string | null;
    }>;
    return (
      <ConsoleShell
        title="Gestores e permissões"
        kicker="ADMINISTRAÇÃO / RESPONSABILIDADES"
        name={actor.name}
        admin
        active="grants"
        message={q.ok}
        error={q.error}
      >
        <p>
          <UiCopy
            pt="Defina a pessoa, sua responsabilidade e onde ela pode atuar."
            en="Choose a person, their responsibility and where they may act."
          />
        </p>
        <Help>
          <UiCopy
            pt="Gestor é uma pessoa com uma ou mais capacidades reais, como editar horários ou matrículas. Cargos da instalação antiga não concedem acesso automaticamente. Remover uma responsabilidade retira esse acesso imediatamente."
            en="A manager has one or more specific capabilities, such as editing schedules or enrollments. Old roles do not grant automatic promotion. Revoking a grant takes effect immediately."
          />
        </Help>
        <AdminActionPanel title="Adicionar gestor">
          <GrantForm
            users={users}
            institutions={institutions}
            programs={programs}
            cohorts={cohorts}
            offerings={offerings}
          />
        </AdminActionPanel>
        <h2>
          <UiCopy pt="Responsabilidades ativas" en="Active responsibilities" />
        </h2>
        <div className="v2-list">
          {grants.map((g) => (
            <div key={g.id} className="v2-row">
              <div>
                <strong>{g.user}</strong> ·{" "}
                {capabilityLabel[g.capability]
                  ? tr(...capabilityLabel[g.capability])
                  : tr("Responsabilidade", "Responsibility")}{" "}
                · {g.scope ?? tr("Escopo específico", "Specific scope")}
              </div>
              <form action={controlAction}>
                <HiddenContext
                  returnTo="/control/grants"
                  intent="revoke"
                  id={g.id}
                />
                <button>
                  <UiCopy pt="Remover acesso" en="Revoke" />
                </button>
              </form>
            </div>
          ))}
        </div>
      </ConsoleShell>
    );
  });
}
