import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../actions";
import { ConsoleShell, HiddenContext, Help } from "../ui";
export default async function Grants({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
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
        title="Permissões de Gestão"
        kicker="Admin · delegação"
        name={actor.name}
        admin
        message={q.ok}
        error={q.error}
      >
        <p>
          Conceda uma capacidade para um curso específico. O servidor verifica
          cada ação no escopo; acesso a infraestrutura ou conteúdo privado não é
          delegado.
        </p>
        <Help>
          Gestor é uma pessoa com uma ou mais capacidades reais, como editar
          horários ou matrículas. Não há promoção automática a partir de roles
          antigos. Revogar um grant tem efeito imediato.
        </Help>
        {[
          {
            kind: "institution",
            label: "Instituição",
            items: institutions,
            caps: [
              ["manage_academics", "Estrutura acadêmica"],
              ["manage_cohort", "Turmas e períodos"],
              ["manage_schedule", "Horários"],
              ["manage_enrollments", "Matrículas"],
            ],
          },
          {
            kind: "program",
            label: "Curso",
            items: programs,
            caps: [
              ["manage_academics", "Estrutura acadêmica"],
              ["manage_cohort", "Turmas e períodos"],
              ["manage_schedule", "Horários"],
              ["manage_enrollments", "Matrículas"],
            ],
          },
          {
            kind: "cohort",
            label: "Turma",
            items: cohorts,
            caps: [
              ["manage_cohort", "Turmas e períodos"],
              ["manage_enrollments", "Matrículas"],
            ],
          },
          {
            kind: "offering",
            label: "Turma da disciplina",
            items: offerings,
            caps: [
              ["manage_academics", "Editar oferta"],
              ["manage_schedule", "Horários"],
              ["manage_enrollments", "Matrículas"],
            ],
          },
        ].map((group) => (
          <details key={group.kind}>
            <summary>Conceder em {group.label.toLowerCase()}</summary>
            <form action={controlAction} className="v2-fields">
              <HiddenContext
                returnTo="/control/grants"
                intent="grant"
                scopeKind={group.kind}
              />
              <label>
                Usuário
                <select name="userId" required>
                  <option value="">Selecione</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Capacidade
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
                  <option value="">Selecione</option>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button>Conceder</button>
            </form>
          </details>
        ))}
        <h2>Grants ativos</h2>
        <div className="v2-list">
          {grants.map((g) => (
            <div key={g.id} className="v2-row">
              <div>
                {g.user} · {g.capability} · {g.scope ?? "outro escopo"}
              </div>
              <form action={controlAction}>
                <HiddenContext
                  returnTo="/control/grants"
                  intent="revoke"
                  id={g.id}
                />
                <button>Revogar</button>
              </form>
            </div>
          ))}
        </div>
      </ConsoleShell>
    );
  });
}
