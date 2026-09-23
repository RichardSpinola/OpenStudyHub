import type { Actor } from "@/lib/v2/actor";
import Link from "next/link";
import type { V2Database } from "@/lib/v2/database";
import { canManage } from "@/lib/v2/access";
import { visiblePrograms } from "@/lib/v2/control";
import { controlAction } from "./actions";
import { ConsoleShell, HiddenContext, Help } from "./ui";
import { ScheduleEditor } from "./schedule-editor";
import { previewCohortEnrollment } from "@/lib/v2/users";

type Row = {
  id: number;
  name: string;
  archived_at?: number | null;
  code?: string;
};
const rows = <T,>(
  db: V2Database,
  sql: string,
  ...params: (string | number)[]
) => db.prepare(sql).all(...params) as T[];
const option = (items: Array<{ id: number; name: string }>) =>
  items.map((x) => (
    <option key={x.id} value={x.id}>
      {x.name}
    </option>
  ));
function Field({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} />
    </label>
  );
}
function Select({
  name,
  label,
  items,
  optional = false,
}: {
  name: string;
  label: string;
  items: Array<{ id: number; name: string }>;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} required={!optional}>
        <option value="">{optional ? "Não definido" : "Selecione"}</option>
        {option(items)}
      </select>
    </label>
  );
}
function Create({
  intent,
  title,
  path,
  children,
}: {
  intent: string;
  title: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <details>
      <summary>{title}</summary>
      <form action={controlAction} className="v2-fields">
        <HiddenContext returnTo={path} intent={intent} />
        {children}
        <button type="submit">Salvar</button>
      </form>
    </details>
  );
}
function List({
  title,
  items,
  entity,
  path,
  editable = true,
}: {
  title: string;
  items: Row[];
  entity: string;
  path: string;
  editable?: boolean;
}) {
  return (
    <section>
      <h3>
        {title} <span className="v2-muted">({items.length})</span>
      </h3>
      {items.length ? (
        <div className="v2-list">
          {items.map((x) => (
            <div className="v2-row" key={x.id}>
              <div>
                <strong>{x.name}</strong>{" "}
                <span className="v2-muted">#{x.id}</span>
                {x.archived_at ? <span> · Arquivado</span> : null}
              </div>
              {editable ? (
                <div className="v2-actions">
                  <details>
                    <summary>Editar</summary>
                    <form action={controlAction} className="v2-fields">
                      <HiddenContext
                        returnTo={path}
                        intent="edit"
                        entity={entity}
                        id={x.id}
                      />
                      {entity === "curricula" ? (
                        <label>
                          Versão do currículo
                          <input
                            name="version"
                            defaultValue={x.name}
                            required
                          />
                        </label>
                      ) : (
                        <>
                          <label>
                            Código
                            <input
                              name="code"
                              defaultValue={x.code ?? ""}
                              required
                            />
                          </label>
                          <label>
                            Nome
                            <input name="name" defaultValue={x.name} required />
                          </label>
                        </>
                      )}
                      <button>Salvar alterações</button>
                    </form>
                  </details>
                  <form action={controlAction}>
                    <HiddenContext
                      returnTo={path}
                      intent="lifecycle"
                      entity={entity}
                      id={x.id}
                      operation={x.archived_at ? "reactivate" : "archive"}
                    />
                    <button>{x.archived_at ? "Reativar" : "Arquivar"}</button>
                  </form>
                  <details>
                    <summary>Excluir</summary>
                    <p>
                      Exclusão permitida só se não houver vínculos ou histórico.
                      Caso contrário, use arquivamento.
                    </p>
                    <form action={controlAction}>
                      <HiddenContext
                        returnTo={path}
                        intent="lifecycle"
                        entity={entity}
                        id={x.id}
                        operation="delete"
                      />
                      <label>
                        <input type="checkbox" required /> Entendo que é uma
                        exclusão definitiva
                      </label>
                      <button className="v2-danger">
                        Excluir sem vínculos
                      </button>
                    </form>
                  </details>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p>Nenhum registro ainda.</p>
      )}
    </section>
  );
}

export function ManagementPanel({
  db,
  actor,
  name,
  admin,
  selected,
  section,
  base,
  message,
  error,
  batchCohort = 0,
  batchOffering = 0,
}: {
  db: V2Database;
  actor: Actor;
  name: string;
  admin: boolean;
  selected: number;
  section: string;
  base: string;
  message?: string;
  error?: string;
  batchCohort?: number;
  batchOffering?: number;
}) {
  const programs = visiblePrograms(db, actor);
  const program = programs.find((p) => p.id === selected) ?? programs[0];
  const pid = program?.id ?? 0;
  const path = `${base}?program=${pid}&section=${section}`;
  const canStructure =
    pid &&
    canManage(db, actor, "manage_academics", { kind: "program", id: pid });
  const canCohort =
    pid && canManage(db, actor, "manage_cohort", { kind: "program", id: pid });
  const canSchedule =
    pid &&
    canManage(db, actor, "manage_schedule", { kind: "program", id: pid });
  const canEnrollment =
    pid &&
    canManage(db, actor, "manage_enrollments", { kind: "program", id: pid });
  const institutionId = pid
    ? (
        db
          .prepare("SELECT institution_id id FROM programs WHERE id=?")
          .get(pid) as { id: number }
      ).id
    : 0;
  const canInstitutionManage =
    institutionId &&
    canManage(db, actor, "manage_academics", {
      kind: "institution",
      id: institutionId,
    });
  const institution = pid
    ? (
        db
          .prepare("SELECT name FROM institutions WHERE id=?")
          .get(institutionId) as { name: string }
      ).name
    : "";
  const shifts = pid
    ? rows<Row>(
        db,
        "SELECT id,name,code,archived_at FROM shifts WHERE institution_id=? ORDER BY name",
        institutionId,
      )
    : [];
  const curricula = pid
    ? rows<Row>(
        db,
        "SELECT id,version name,archived_at FROM curricula WHERE program_id=? ORDER BY id",
        pid,
      )
    : [];
  const semesters = pid
    ? rows<{ id: number; name: string }>(
        db,
        "SELECT cs.id,cs.ordinal || 'º semestre' name FROM curriculum_semesters cs JOIN curricula c ON c.id=cs.curriculum_id WHERE c.program_id=? ORDER BY cs.ordinal",
        pid,
      )
    : [];
  const cohortsAll = pid
    ? rows<Row>(
        db,
        "SELECT id,name,code,archived_at FROM cohorts WHERE program_id=? ORDER BY id",
        pid,
      )
    : [];
  const cohorts = admin
    ? cohortsAll
    : cohortsAll.filter((c) =>
        [
          "manage_academics",
          "manage_cohort",
          "manage_schedule",
          "manage_enrollments",
        ].some((cap) =>
          canManage(db, actor, cap as "manage_academics", {
            kind: "cohort",
            id: c.id,
          }),
        ),
      );
  const periods = rows<{ id: number; name: string }>(
    db,
    "SELECT id,label name FROM academic_periods WHERE institution_id=? AND archived_at IS NULL ORDER BY starts_on DESC",
    institutionId,
  );
  const subjects = rows<Row>(
    db,
    "SELECT id,name,archived_at FROM subjects WHERE institution_id=? ORDER BY name",
    institutionId,
  );
  const instructors = rows<Row>(
    db,
    "SELECT id,name,archived_at FROM instructors WHERE institution_id=? ORDER BY name",
    institutionId,
  );
  const locations = rows<Row>(
    db,
    "SELECT id,name,archived_at FROM locations WHERE institution_id=? ORDER BY name",
    institutionId,
  );
  const mappings = pid
    ? rows<{ id: number; name: string }>(
        db,
        "SELECT m.id,cs.ordinal || 'º · ' || s.name name FROM curriculum_subjects m JOIN curriculum_semesters cs ON cs.id=m.semester_id JOIN curricula c ON c.id=cs.curriculum_id JOIN subjects s ON s.id=m.subject_id WHERE c.program_id=? ORDER BY cs.ordinal,s.name",
        pid,
      )
    : [];
  const offeringsAll = pid
    ? rows<{
        id: number;
        name: string;
        archived_at: number | null;
        period: string;
        state: string;
        instructorId: number | null;
        shiftId: number | null;
        classGroup: string | null;
      }>(
        db,
        "SELECT o.id,s.name || COALESCE(' · ' || o.class_group,'') name,o.archived_at,ap.label period,o.state,o.instructor_id instructorId,o.shift_id shiftId,o.class_group classGroup FROM offerings o JOIN subjects s ON s.id=o.subject_id JOIN academic_periods ap ON ap.id=o.period_id WHERE o.program_id=? ORDER BY ap.starts_on DESC,s.name",
        pid,
      )
    : [];
  const offerings = admin
    ? offeringsAll
    : offeringsAll.filter(
        (o) =>
          ["manage_academics", "manage_schedule", "manage_enrollments"].some(
            (cap) =>
              canManage(db, actor, cap as "manage_academics", {
                kind: "offering",
                id: o.id,
              }),
          ) ||
          (!!db
            .prepare(
              "SELECT 1 FROM offering_cohorts WHERE offering_id=? AND cohort_id IN (SELECT id FROM cohorts WHERE program_id=?)",
            )
            .get(o.id, pid) &&
            cohorts.some(
              (c) =>
                !!db
                  .prepare(
                    "SELECT 1 FROM offering_cohorts WHERE offering_id=? AND cohort_id=?",
                  )
                  .get(o.id, c.id),
            )),
      );
  const cohortPeriodsAll = pid
    ? rows<{ id: number; name: string; state: string; cohortId: number }>(
        db,
        "SELECT cp.id,c.id cohortId,c.name || ' · ' || ap.label || ' · ' || cs.ordinal || 'º' name,cp.state FROM cohort_periods cp JOIN cohorts c ON c.id=cp.cohort_id JOIN academic_periods ap ON ap.id=cp.period_id JOIN curriculum_semesters cs ON cs.id=cp.semester_id WHERE c.program_id=? ORDER BY ap.starts_on DESC",
        pid,
      )
    : [];
  const canCohortScoped =
    !!canCohort ||
    cohorts.some((c) =>
      canManage(db, actor, "manage_cohort", { kind: "cohort", id: c.id }),
    );
  const canScheduleScoped =
    !!canSchedule ||
    offerings.some((o) =>
      canManage(db, actor, "manage_schedule", { kind: "offering", id: o.id }),
    );
  const cohortPeriods = cohortPeriodsAll.filter((cp) =>
    cohorts.some((c) => c.id === cp.cohortId),
  );
  const enrollmentCohorts = cohorts.filter((c) =>
    canManage(db, actor, "manage_enrollments", { kind: "cohort", id: c.id }),
  );
  const canEnrollmentScoped =
    !!canEnrollment ||
    enrollmentCohorts.length > 0 ||
    offerings.some((o) =>
      canManage(db, actor, "manage_enrollments", {
        kind: "offering",
        id: o.id,
      }),
    );
  const members = enrollmentCohorts.length
    ? rows<{ id: number; name: string; cohortId: number }>(
        db,
        "SELECT DISTINCT u.id,u.display_name name,x.cohort_id cohortId FROM users u JOIN user_academic_contexts x ON x.user_id=u.id WHERE x.program_id=? AND u.active=1 ORDER BY u.display_name",
        pid,
      ).filter((x) => enrollmentCohorts.some((c) => c.id === x.cohortId))
    : [];
  let batchPreview: ReturnType<typeof previewCohortEnrollment> | null = null;
  let batchError = "";
  if (batchCohort && batchOffering) {
    try {
      batchPreview = previewCohortEnrollment(
        db,
        actor,
        batchCohort,
        batchOffering,
      );
    } catch (e) {
      batchError = e instanceof Error ? e.message : "Prévia indisponível.";
    }
  }
  const tabs = [
    { key: "structure", label: "Estrutura" },
    { key: "curriculum", label: "Currículo" },
    { key: "offerings", label: "Turmas da disciplina" },
    { key: "schedule", label: "Horários" },
    { key: "enrollments", label: "Matrículas" },
  ];
  return (
    <ConsoleShell
      title={admin ? "Estrutura acadêmica" : "Gestão acadêmica"}
      kicker={admin ? "Admin · control plane" : "Gestão · escopos delegados"}
      name={name}
      admin={admin}
      message={message}
      error={error}
    >
      <p>
        Escolha o curso para manter o contexto durante as alterações. Salvar
        volta à mesma seção e ao mesmo curso.
      </p>
      {programs.length ? (
        <>
          <div className="v2-list">
            {programs.map((p) => (
              <Link
                className="v2-button"
                key={p.id}
                href={`${base}?program=${p.id}&section=${section}`}
                aria-current={pid === p.id ? "page" : undefined}
              >
                {p.institution} / {p.name}
              </Link>
            ))}
          </div>
          <div className="v2-context">
            <strong>Contexto:</strong> {institution} / {program.name} ·{" "}
            <strong>Período e turma:</strong> selecione na operação
          </div>
          <nav className="v2-tabs" aria-label="Áreas do curso">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`${base}?program=${pid}&section=${t.key}`}
                aria-current={section === t.key ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {section === "structure" ? (
            <>
              <h2>Curso, turno e turma</h2>
              <Help>
                Curso é a formação. Turma reúne estudantes de um curso,
                currículo e turno. Arquivar preserva vínculos; excluir só
                funciona quando o registro não tem dependências.
              </Help>
              {canInstitutionManage ? (
                <>
                  <Create title="Adicionar turno" intent="shift" path={path}>
                    <HiddenContext
                      returnTo={path}
                      institutionId={institutionId}
                    />
                    <Field name="code" label="Código" />
                    <Field name="name" label="Nome do turno" />
                  </Create>
                </>
              ) : null}
              {canStructure ? (
                <>
                  <Create
                    title="Adicionar currículo"
                    intent="curriculum"
                    path={path}
                  >
                    <HiddenContext returnTo={path} programId={pid} />
                    <Field name="version" label="Versão do currículo" />
                  </Create>
                </>
              ) : null}
              {canCohort ? (
                <Create title="Adicionar turma" intent="cohort" path={path}>
                  <HiddenContext returnTo={path} programId={pid} />
                  <Field name="code" label="Código" />
                  <Field name="name" label="Nome da turma" />
                  <Select
                    name="curriculumId"
                    label="Currículo"
                    items={curricula}
                  />
                  <Select name="shiftId" label="Turno" items={shifts} />
                </Create>
              ) : null}
              <List
                title="Turnos"
                items={shifts}
                entity="shifts"
                path={path}
                editable={!!canInstitutionManage}
              />
              <List
                title="Turmas"
                items={cohorts}
                entity="cohorts"
                path={path}
                editable={!!canCohort}
              />
            </>
          ) : null}
          {section === "curriculum" ? (
            <>
              <h2>Currículo e períodos</h2>
              <Help>
                Semestre curricular é a posição no curso (1º, 2º...). Período
                letivo é a janela no calendário (por exemplo, 2030.1). A turma
                conecta os dois sem misturá-los.
              </Help>
              {canStructure ? (
                <>
                  <Create
                    title="Adicionar semestre curricular"
                    intent="semester"
                    path={path}
                  >
                    <Select
                      name="curriculumId"
                      label="Currículo"
                      items={curricula}
                    />
                    <Field
                      name="ordinal"
                      label="Número do semestre"
                      type="number"
                    />
                  </Create>
                  <Create
                    title="Associar disciplina ao semestre"
                    intent="mapping"
                    path={path}
                  >
                    <Select
                      name="semesterId"
                      label="Semestre"
                      items={semesters}
                    />
                    <Select
                      name="subjectId"
                      label="Disciplina"
                      items={subjects}
                    />
                  </Create>
                </>
              ) : null}
              {canCohortScoped ? (
                <Create
                  title="Preparar período para turma"
                  intent="cohortPeriod"
                  path={path}
                >
                  <Select name="cohortId" label="Turma" items={cohorts} />
                  <Select
                    name="periodId"
                    label="Período letivo"
                    items={periods}
                  />
                  <Select
                    name="semesterId"
                    label="Semestre curricular"
                    items={semesters}
                  />
                </Create>
              ) : null}
              <List
                title="Currículos"
                items={curricula}
                entity="curricula"
                path={path}
                editable={!!canStructure}
              />
              <h3>Semestres</h3>
              <p>
                {semesters.map((s) => s.name).join(" · ") || "Nenhum semestre."}
              </p>
              <h3>Períodos desta turma</h3>
              <div className="v2-list">
                {cohortPeriods.map((cp) => (
                  <div key={cp.id} className="v2-row">
                    {cp.name} · {cp.state}
                  </div>
                ))}
              </div>
              {admin ? (
                <p>
                  <Link href="/control/transition">Preparar transição →</Link>
                </p>
              ) : (
                <p>
                  <Link href={`/gestao/transition?program=${pid}`}>
                    Preparar transição →
                  </Link>
                </p>
              )}
            </>
          ) : null}
          {section === "offerings" ? (
            <>
              <h2>Turmas da disciplina</h2>
              <Help>
                Uma turma da disciplina é a oferta concreta em um período
                letivo. Cada novo período e cada repetição usam uma oferta nova;
                a anterior fica no histórico.
              </Help>
              {canStructure ? (
                <>
                  <Create
                    title="Criar turma da disciplina"
                    intent="offering"
                    path={path}
                  >
                    <HiddenContext returnTo={path} programId={pid} />
                    <Select
                      name="subjectId"
                      label="Disciplina"
                      items={subjects}
                    />
                    <Select name="periodId" label="Período" items={periods} />
                    <Select
                      name="shiftId"
                      label="Turno"
                      items={shifts}
                      optional
                    />
                    <Select
                      name="instructorId"
                      label="Professor"
                      items={instructors}
                      optional
                    />
                    <Select
                      name="mappingId"
                      label="Mapa curricular"
                      items={mappings}
                      optional
                    />
                    <Field
                      name="classGroup"
                      label="Grupo (opcional)"
                      required={false}
                    />
                  </Create>
                </>
              ) : null}
              {canCohortScoped ? (
                <>
                  <Create
                    title="Vincular oferta à turma"
                    intent="offeringCohort"
                    path={path}
                  >
                    <Select
                      name="offeringId"
                      label="Turma da disciplina"
                      items={offerings}
                    />
                    <Select
                      name="cohortId"
                      label="Turma de estudantes"
                      items={cohorts}
                    />
                  </Create>
                </>
              ) : null}
              <div className="v2-list">
                {offerings.map((o) => (
                  <div className="v2-row" key={o.id}>
                    <span>
                      {o.name} · {o.period} {o.archived_at ? "· Arquivada" : ""}
                    </span>
                    {canStructure && o.state === "planned" && !o.archived_at ? (
                      <details>
                        <summary>Editar oferta preparada</summary>
                        <form action={controlAction} className="v2-fields">
                          <HiddenContext
                            returnTo={path}
                            intent="edit"
                            entity="offerings"
                            id={o.id}
                          />
                          <label>
                            Professor
                            <select
                              name="instructorId"
                              defaultValue={o.instructorId ?? ""}
                            >
                              <option value="">Não definido</option>
                              {option(instructors)}
                            </select>
                          </label>
                          <label>
                            Turno
                            <select
                              name="shiftId"
                              defaultValue={o.shiftId ?? ""}
                            >
                              <option value="">Não definido</option>
                              {option(shifts)}
                            </select>
                          </label>
                          <label>
                            Grupo
                            <input
                              name="classGroup"
                              defaultValue={o.classGroup ?? ""}
                            />
                          </label>
                          <button>Salvar alterações</button>
                        </form>
                      </details>
                    ) : null}
                    {canStructure ? (
                      <form action={controlAction}>
                        <HiddenContext
                          returnTo={path}
                          intent="lifecycle"
                          entity="offerings"
                          id={o.id}
                          operation={o.archived_at ? "reactivate" : "archive"}
                        />
                        <button>
                          {o.archived_at ? "Reativar" : "Arquivar"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {section === "schedule" ? (
            <>
              <h2>Horários</h2>
              <p>
                Edite todos os blocos de uma turma da disciplina de uma vez. Os
                dias e horários existentes aparecem antes de salvar.
              </p>
              {canScheduleScoped && offerings.length ? (
                <ScheduleEditor
                  offerings={offerings}
                  locations={locations}
                  slots={rows<{
                    offering_id: number;
                    weekday: number;
                    starts_at_minutes: number;
                    ends_at_minutes: number;
                    location_id: number | null;
                  }>(
                    db,
                    "SELECT sl.offering_id,sl.weekday,sl.starts_at_minutes,sl.ends_at_minutes,sl.location_id FROM schedule_slots sl JOIN offerings o ON o.id=sl.offering_id WHERE o.program_id=? ORDER BY sl.weekday,sl.starts_at_minutes",
                    pid,
                  ).filter((slot) =>
                    offerings.some((o) => o.id === slot.offering_id),
                  )}
                  returnTo={path}
                />
              ) : (
                <p>
                  {offerings.length
                    ? "Sem permissão para editar horários."
                    : "Crie primeiro uma turma da disciplina."}
                </p>
              )}
            </>
          ) : null}
          {section === "enrollments" ? (
            <>
              <h2>Matrículas</h2>
              <p>
                Estudantes vinculados a este curso podem ser matriculados em uma
                turma da disciplina. O histórico anterior permanece.
              </p>
              {canEnrollmentScoped ? (
                <Create
                  title="Matricular estudante"
                  intent="enroll"
                  path={path}
                >
                  <Select name="userId" label="Estudante" items={members} />
                  <Select
                    name="offeringId"
                    label="Turma da disciplina"
                    items={offerings}
                  />
                </Create>
              ) : null}
              {canEnrollmentScoped ? (
                <details open={!!batchPreview}>
                  <summary>Matricular turma inteira</summary>
                  <p>
                    Selecione uma turma e uma turma da disciplina vinculada para
                    pré-visualizar o lote. Nenhuma matrícula é aplicada na
                    prévia.
                  </p>
                  <form method="get" action={base} className="v2-fields">
                    <input type="hidden" name="program" value={pid} />
                    <input type="hidden" name="section" value="enrollments" />
                    <Select
                      name="batchCohort"
                      label="Turma"
                      items={enrollmentCohorts}
                    />
                    <Select
                      name="batchOffering"
                      label="Turma da disciplina"
                      items={offerings}
                    />
                    <button>Pré-visualizar lote</button>
                  </form>
                  {batchError ? (
                    <div className="v2-message" data-type="error" role="alert">
                      {batchError}
                    </div>
                  ) : null}
                  {batchPreview ? (
                    <>
                      <p>
                        {batchPreview.total} estudantes ativos na turma;{" "}
                        {batchPreview.pending} matrículas novas ou reativadas. O
                        lote é atômico.
                      </p>
                      <form action={controlAction}>
                        <HiddenContext
                          returnTo={`${path}&batchCohort=${batchCohort}&batchOffering=${batchOffering}`}
                          intent="enrollCohort"
                          cohortId={batchCohort}
                          offeringId={batchOffering}
                        />
                        <label>
                          Digite{" "}
                          <strong>MATRICULAR {batchPreview.pending}</strong>
                          <input name="confirmation" required />
                        </label>
                        <button>Aplicar matrículas em lote</button>
                      </form>
                    </>
                  ) : null}
                </details>
              ) : (
                <p>Sem permissão para matrículas neste escopo.</p>
              )}
              {canEnrollmentScoped ? (
                <div className="v2-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Estudante</th>
                        <th>Turma da disciplina</th>
                        <th>Origem</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows<{
                        id: number;
                        student: string;
                        offering: string;
                        source: string;
                        offeringId: number;
                        withdrawn_at: number | null;
                        userId: number;
                      }>(
                        db,
                        "SELECT e.id,e.user_id userId,o.id offeringId,u.display_name student,s.name || ' · ' || ap.label offering,e.source,e.withdrawn_at FROM enrollments e JOIN users u ON u.id=e.user_id JOIN offerings o ON o.id=e.offering_id JOIN subjects s ON s.id=o.subject_id JOIN academic_periods ap ON ap.id=o.period_id WHERE o.program_id=? ORDER BY e.id DESC LIMIT 100",
                        pid,
                      )
                        .filter(
                          (e) =>
                            offerings.some((o) => o.id === e.offeringId) &&
                            (canManage(db, actor, "manage_enrollments", {
                              kind: "offering",
                              id: e.offeringId,
                            }) ||
                              members.some((m) => m.id === e.userId)),
                        )
                        .map((e) => (
                          <tr key={e.id}>
                            <td>{e.student}</td>
                            <td>{e.offering}</td>
                            <td>
                              {e.source}
                              {e.withdrawn_at ? " · Retirada" : ""}
                            </td>
                            <td>
                              {!e.withdrawn_at ? (
                                <form action={controlAction}>
                                  <HiddenContext
                                    returnTo={path}
                                    intent="withdraw"
                                    id={e.id}
                                  />
                                  <button>Retirar</button>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <p>Nenhum curso disponível no seu escopo de Gestão.</p>
      )}
    </ConsoleShell>
  );
}
