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
        "SELECT id,name FROM programs WHERE archived_at IS NULL ORDER BY name",
      )
      .all() as Array<{ id: number; name: string }>;
    const institutions = db
      .prepare(
        "SELECT id,name FROM institutions WHERE archived_at IS NULL ORDER BY name",
      )
      .all() as Array<{ id: number; name: string }>;
    const cohorts = db
      .prepare(
        "SELECT c.id,p.name || ' / ' || c.name name FROM cohorts c JOIN programs p ON p.id=c.program_id WHERE c.archived_at IS NULL ORDER BY p.name,c.name",
      )
      .all() as Array<{ id: number; name: string }>;
    const offerings = db
      .prepare(
        "SELECT o.id,p.name || ' / ' || s.name || ' / ' || ap.label name FROM offerings o JOIN programs p ON p.id=o.program_id JOIN subjects s ON s.id=o.subject_id JOIN academic_periods ap ON ap.id=o.period_id WHERE o.archived_at IS NULL ORDER BY p.name,s.name",
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
            pt="Gestor é uma pessoa com uma ou mais capacidades reais, como editar horários ou matrículas. Não há promoção automática a partir de roles antigos. Revogar um grant tem efeito imediato."
            en="A manager has one or more specific capabilities, such as editing schedules or enrollments. Old roles do not grant automatic promotion. Revoking a grant takes effect immediately."
          />
        </Help>
        {[
          {
            kind: "institution",
            label: tr("Instituição", "Institution"),
            items: institutions,
            caps: [
              [
                "manage_academics",
                tr("Estrutura acadêmica", "Academic structure"),
              ],
              ["manage_cohort", tr("Turmas e períodos", "Cohorts and periods")],
              ["manage_schedule", tr("Horários", "Schedules")],
              ["manage_enrollments", tr("Matrículas", "Enrollments")],
            ],
          },
          {
            kind: "program",
            label: tr("Curso", "Program"),
            items: programs,
            caps: [
              [
                "manage_academics",
                tr("Estrutura acadêmica", "Academic structure"),
              ],
              ["manage_cohort", tr("Turmas e períodos", "Cohorts and periods")],
              ["manage_schedule", tr("Horários", "Schedules")],
              ["manage_enrollments", tr("Matrículas", "Enrollments")],
            ],
          },
          {
            kind: "cohort",
            label: tr("Turma", "Cohort"),
            items: cohorts,
            caps: [
              ["manage_cohort", tr("Turmas e períodos", "Cohorts and periods")],
              ["manage_enrollments", tr("Matrículas", "Enrollments")],
            ],
          },
          {
            kind: "offering",
            label: tr("Turma da disciplina", "Subject offering"),
            items: offerings,
            caps: [
              ["manage_academics", tr("Editar oferta", "Edit offering")],
              ["manage_schedule", tr("Horários", "Schedules")],
              ["manage_enrollments", tr("Matrículas", "Enrollments")],
            ],
          },
        ].map((group) => (
          <AdminActionPanel
            key={group.kind}
            title={
              tr("Conceder em", "Grant for") + ` ${group.label.toLowerCase()}`
            }
          >
            <form action={controlAction} className="v2-fields">
              <HiddenContext
                returnTo="/control/grants"
                intent="grant"
                scopeKind={group.kind}
              />
              <label>
                <UiCopy pt="Pessoa" en="Person" />
                <select name="userId" required>
                  <option value="">
                    <UiCopy pt="Selecione" en="Select" />
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <UiCopy pt="Responsabilidade" en="Responsibility" />
                <select name="capability">
                  {group.caps.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {group.label}
                <select name="scopeId" required>
                  <option value="">
                    <UiCopy pt="Selecione" en="Select" />
                  </option>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button>
                <UiCopy
                  pt="Conceder responsabilidade"
                  en="Grant responsibility"
                />
              </button>
            </form>
          </AdminActionPanel>
        ))}
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
                  <UiCopy pt="Revogar" en="Revoke" />
                </button>
              </form>
            </div>
          ))}
        </div>
      </ConsoleShell>
    );
  });
}
