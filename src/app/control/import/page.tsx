import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { ConsoleShell } from "../ui";
import { academicImportAction } from "./actions";
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  return withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin) redirect("/control/login");
    if (admin.mustChangePassword) redirect("/control/password");
    const run = db
      .prepare("SELECT id,status FROM import_runs WHERE id=?")
      .get(Number(q.run) || -1) as { id: number; status: string } | undefined;
    const reviews = run
      ? (db
          .prepare(
            "SELECT source_table,reason_code FROM import_review_items WHERE run_id=?",
          )
          .all(run.id) as Array<{ source_table: string; reason_code: string }>)
      : [];
    const institutions = db
      .prepare("SELECT id,name FROM institutions WHERE archived_at IS NULL")
      .all() as Array<{ id: number; name: string }>;
    return (
      <ConsoleShell
        title="Importar estrutura V1"
        kicker="ADMINISTRAÇÃO / IMPORTAÇÃO"
        name={admin.name}
        admin
        active="institutions"
        message={q.ok}
        error={q.error}
      >
        <Link className="admin-back-link" href="/control/institutions">
          ← Voltar às instituições
        </Link>
        <section className="workflow-panel">
          <h2>Trazer a estrutura da instalação antiga</h2>
          <p>
            A prévia verifica o banco legado já associado a esta instância.
            Notas, documentos, projetos e arquivos permanecem no banco e nos
            caminhos atuais. Faça um backup antes de executar.
          </p>
          <p>
            Contas Admin antigas permanecem no legado; não recebem privilégios
            do Control Plane. Turmas e matrizes antigas não são deduzidas de
            textos. Os valores originais ficam preservados para revisão.
            Classroom exige reconexão e confirmação pessoal.
          </p>
          <form action={academicImportAction}>
            <input type="hidden" name="intent" value="preview" />
            <button>Gerar prévia</button>
          </form>
        </section>
        {run ? (
          <section className="workflow-panel">
            <h2>
              Prévia #{run.id} ·{" "}
              {run.status === "completed" ? "Concluída" : "Aguardando revisão"}
            </h2>
            <ul>
              {reviews.map((item, i) => (
                <li key={i}>
                  {(
                    {
                      legacy_role_not_control_admin:
                        "Uma conta Admin antiga não recebe permissões automaticamente.",
                      policy_required:
                        "Este conteúdo precisa de uma decisão de importação.",
                      ambiguous_curriculum_term:
                        "Há um semestre antigo que precisa de conferência.",
                    } as Record<string, string>
                  )[item.reason_code] ??
                    `Confira os registros de ${item.source_table.replaceAll("_", " ")}.`}
                </li>
              ))}
            </ul>
            {run.status !== "completed" ? (
              <form action={academicImportAction} className="v2-fields">
                <input type="hidden" name="intent" value="apply" />
                <input type="hidden" name="runId" value={run.id} />
                <label>
                  Instituição de destino
                  <select name="institutionId" required>
                    <option value="">Escolha uma instituição</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input type="checkbox" name="reviewed" required />
                  Revisei a prévia, tenho backup e aceito importar apenas a
                  estrutura acadêmica compatível, preservando os dados antigos e
                  sem promover permissões ou conexões Google.
                </label>
                <button>Importar estrutura acadêmica</button>
              </form>
            ) : (
              <p>
                Importação concluída. Repetir esta execução não cria duplicatas.
              </p>
            )}
          </section>
        ) : null}
      </ConsoleShell>
    );
  });
}
