import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentUserV2 } from "@/lib/v2/runtime";
import { googleConnectionStatus } from "@/lib/v2/google-oauth";
import { eligibleOfferings, suggestClassrooms } from "@/lib/v2/classroom";
import { ConsoleShell } from "../control/ui";
import {
  connectGoogleV2Action,
  connectFakeGoogleAction,
  simulateFakeGoogleAction,
  disconnectGoogleV2Action,
  discoverClassroomsAction,
  confirmClassroomsAction,
} from "./actions";
import { ClassroomSyncStatus } from "./sync-status";
import { fakeGoogleEnabled } from "@/lib/v2/fake-google";

export default async function GoogleOnboarding({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; google?: string }>;
}) {
  const q = await searchParams;
  const data = await withV2DbAsync(async (db) => {
    const user = await currentUserV2(db);
    if (!user) return null;
    const connection = googleConnectionStatus(db, user.id);
    const courses = db
      .prepare(
        "SELECT course_id id,name,section FROM classroom_courses_v2 WHERE user_id=? ORDER BY name,course_id",
      )
      .all(user.id) as Array<{
      id: string;
      name: string;
      section: string | null;
    }>;
    const mappings = db
      .prepare(
        "SELECT offering_id offeringId,course_id courseId FROM user_classroom_mappings WHERE user_id=?",
      )
      .all(user.id) as Array<{ offeringId: number; courseId: string }>;
    return {
      user,
      connection,
      courses,
      mappings,
      suggestions: suggestClassrooms(db, user.id),
      offerings: eligibleOfferings(db, user.id),
    };
  });
  if (!data) redirect("/login");
  if (data.user.mustChangePassword) redirect("/gestao/password");
  const connected = data.connection?.status === "connected";
  const fake = fakeGoogleEnabled();
  return (
    <ConsoleShell
      title="Sua conta Google"
      kicker="OpenStudyHub · integração opcional"
      name={data.user.name}
      message={
        q.ok ||
        (q.google === "connected"
          ? "Google conectado. Busque seus Classrooms."
          : undefined)
      }
      error={
        q.error ||
        (q.google === "error"
          ? "Não foi possível conectar. Confira a configuração ou tente de novo."
          : undefined)
      }
    >
      <p>
        Classroom usa somente sua autorização. Você escolhe as associações com
        as disciplinas do Hub.
      </p>
      <p>
        <Link href="/">Pular Google por agora</Link>
      </p>
      <div className="v2-note" role="status">
        Google:{" "}
        {connected
          ? "Conectado"
          : data.connection?.status === "needs_reconnect"
            ? "Reconectar"
            : "Não conectado"}
        {" · "}
        {data.mappings.length}/{data.offerings.length} matérias associadas
      </div>
      {!connected && (
        <form action={connectGoogleV2Action} className="v2-fields">
          <p>
            Conecte sua conta para buscar Classrooms. O uso básico do Hub
            continua sem Google.
          </p>
          <label>
            <input type="checkbox" name="drive" value="1" /> Também autorizar
            Drive para poder ser escolhido como storage owner
          </label>
          <button type="submit">
            {data.connection ? "Reconectar Google" : "Conectar Google"}
          </button>
        </form>
      )}
      {fake && !connected && (
        <form action={connectFakeGoogleAction}>
          <button type="submit">Conectar Google fictício para QA</button>
        </form>
      )}
      {fake && connected && (
        <div className="v2-actions">
          <form action={simulateFakeGoogleAction}>
            <input type="hidden" name="scenario" value="stale" />
            <button type="submit">Simular cache stale</button>
          </form>
          <form action={simulateFakeGoogleAction}>
            <input type="hidden" name="scenario" value="revoked" />
            <button type="submit">Simular token revogado</button>
          </form>
        </div>
      )}
      {connected && (
        <>
          <div className="v2-actions">
            <form action={discoverClassroomsAction}>
              <button type="submit">Buscar meus Classrooms</button>
            </form>
            <form action={disconnectGoogleV2Action}>
              <button type="submit">Desconectar Google</button>
            </form>
          </div>
          <h2>Associar Classrooms</h2>
          <p>
            Sugestões são apenas ajuda. Revise cada seleção e confirme o lote.
            Classrooms ambíguos ficam sem seleção.
          </p>
          {data.courses.length === 0 ? (
            <p>Busque seus Classrooms para começar.</p>
          ) : (
            <form action={confirmClassroomsAction} className="v2-fields">
              {data.suggestions.map((item) => {
                const current = data.mappings.find(
                  (mapping) => mapping.offeringId === item.offeringId,
                )?.courseId;
                return (
                  <label key={item.offeringId}>
                    {item.subjectName}{" "}
                    {item.subjectCode ? `· ${item.subjectCode}` : ""}
                    {item.ambiguous && (
                      <small>
                        Mais de um Classroom parecido; escolha manualmente.
                      </small>
                    )}
                    {item.suggestion && (
                      <small>
                        Sugestão: {item.suggestion.courseName} ·{" "}
                        {item.suggestion.reason} · confiança{" "}
                        {item.suggestion.confidence}
                      </small>
                    )}
                    <select
                      name={`mapping-${item.offeringId}`}
                      defaultValue={current ?? item.suggestion?.courseId ?? ""}
                    >
                      <option value="">Ainda não associar</option>
                      {data.courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                          {course.section ? ` · ${course.section}` : ""} ·{" "}
                          {course.id}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <button type="submit">Confirmar associações selecionadas</button>
            </form>
          )}
          <h2>Sincronização</h2>
          {data.mappings.length === 0 ? (
            <p>Confirme uma associação para ver o estado de sync.</p>
          ) : (
            data.mappings.map((mapping) => {
              const offering = data.offerings.find(
                (item) => item.offeringId === mapping.offeringId,
              );
              return offering ? (
                <ClassroomSyncStatus
                  key={mapping.offeringId}
                  offeringId={mapping.offeringId}
                  label={offering.subjectName}
                />
              ) : null;
            })
          )}
        </>
      )}
      <p>
        <Link href="/">Concluir e voltar ao Hub</Link>
      </p>
    </ConsoleShell>
  );
}
