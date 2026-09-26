import { UiCopy } from "@/components/ui-language-provider";
import type { Actor } from "@/lib/v2/actor";
import Link from "next/link";
import { ImageUploadPreview } from "@/components/image-upload-preview";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import type { V2Database } from "@/lib/v2/database";
import { canManage } from "@/lib/v2/access";
import { visiblePrograms } from "@/lib/v2/control";
import { controlAction } from "./actions";
import { ConsoleShell, HiddenContext, Help } from "./ui";
import { ScheduleEditor } from "./schedule-editor";
import { previewCohortEnrollment } from "@/lib/v2/users";
import { AdminActionPanel } from "./admin-action-panel";
import { listSubjectOfferings } from "@/lib/academic";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

type Row = {
  id: number;
  name: string;
  archived_at?: number | null;
  code?: string;
};
const fieldLabelEn: Record<string, string> = {
  Código: "Code",
  "Nome da turma": "Cohort name",
  Turno: "Shift",
  "Versão do currículo": "Curriculum version",
  Turma: "Cohort",
  Estudante: "Student",
  Currículo: "Curriculum",
  "Número do semestre": "Semester number",
  "Período letivo": "Academic period",
  Período: "Period",
  "Imagem PNG, JPEG ou WebP · até 5 MiB":
    "PNG, JPEG or WebP image · up to 5 MiB",
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
      <UiCopy pt={label} en={fieldLabelEn[label] ?? label} />
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
      <UiCopy pt={label} en={fieldLabelEn[label] ?? label} />
      <select name={name} required={!optional}>
        <option value="">
          {optional ? (
            <UiCopy pt="Não definido" en="Not set" />
          ) : (
            <UiCopy pt="Selecione" en="Select" />
          )}
        </option>
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
    <AdminActionPanel title={title}>
      <form action={controlAction} className="v2-fields">
        <HiddenContext returnTo={path} intent={intent} />
        {children}
        <button type="submit">
          <UiCopy pt="Salvar" en="Save" />
        </button>
      </form>
    </AdminActionPanel>
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
        <UiCopy
          pt={title}
          en={{ Turmas: "Cohorts", Currículos: "Curricula" }[title] ?? title}
        />{" "}
        <span className="v2-muted">({items.length})</span>
      </h3>
      {items.length ? (
        <div className="v2-list">
          {items.map((x) => (
            <div className="v2-row" key={x.id}>
              <div>
                <strong>{x.name}</strong>{" "}
                {x.archived_at ? (
                  <span>
                    {" "}
                    <UiCopy pt="· Arquivado" en="· Archived" />
                  </span>
                ) : null}
              </div>
              {editable ? (
                <div className="v2-actions">
                  <AdminActionPanel
                    title={uiText(
                      getUiLanguage(),
                      `Editar ${x.name}`,
                      `Edit ${x.name}`,
                    )}
                  >
                    <form action={controlAction} className="v2-fields">
                      <HiddenContext
                        returnTo={path}
                        intent="edit"
                        entity={entity}
                        id={x.id}
                      />
                      {entity === "curricula" ? (
                        <label>
                          <UiCopy
                            pt="Versão do currículo"
                            en="Curriculum version"
                          />
                          <input
                            name="version"
                            defaultValue={x.name}
                            required
                          />
                        </label>
                      ) : (
                        <>
                          <label>
                            <UiCopy pt="Código" en="Code" />
                            <input
                              name="code"
                              defaultValue={x.code ?? ""}
                              required
                            />
                          </label>
                          <label>
                            <UiCopy pt="Nome" en="Name" />
                            <input name="name" defaultValue={x.name} required />
                          </label>
                        </>
                      )}
                      <button>
                        <UiCopy pt="Salvar alterações" en="Save changes" />
                      </button>
                    </form>
                  </AdminActionPanel>
                  <form action={controlAction}>
                    <HiddenContext
                      returnTo={path}
                      intent="lifecycle"
                      entity={entity}
                      id={x.id}
                      operation={x.archived_at ? "reactivate" : "archive"}
                    />
                    <button>
                      {x.archived_at ? (
                        <UiCopy pt="Reativar" en="Reactivate" />
                      ) : (
                        <UiCopy pt="Arquivar" en="Archive" />
                      )}
                    </button>
                  </form>
                  <details>
                    <summary>
                      <UiCopy pt="Excluir" en="Delete" />
                    </summary>
                    <p>
                      <UiCopy
                        pt="Exclusão permitida só se não houver vínculos ou histórico. Caso contrário, use arquivamento."
                        en="Deletion is allowed only when there are no links or history. Otherwise, archive it."
                      />
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
                        <input type="checkbox" required />
                        <UiCopy
                          pt="Entendo que é uma exclusão definitiva"
                          en="I understand this deletion is permanent"
                        />
                      </label>
                      <button className="v2-danger">
                        <UiCopy
                          pt="Excluir sem vínculos"
                          en="Delete without links"
                        />
                      </button>
                    </form>
                  </details>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p>
          <UiCopy pt="Nenhum registro ainda." en="No records yet." />
        </p>
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
  contextual = false,
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
  contextual?: boolean;
}) {
  const tr = (pt: string, en: string) => uiText(getUiLanguage(), pt, en);
  const programs = visiblePrograms(db, actor);
  const program = programs.find((p) => p.id === selected) ?? programs[0];
  const pid = program?.id ?? 0;
  const programShortName = pid
    ? (
        db
          .prepare("SELECT short_name shortName FROM programs WHERE id=?")
          .get(pid) as { shortName: string | null }
      ).shortName
    : null;
  const sectionPath = (next: string) =>
    contextual
      ? `${base}?section=${next}`
      : `${base}?program=${pid}&section=${next}`;
  const path = sectionPath(section);
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
  const legacyOfferings = admin && contextual ? listSubjectOfferings() : [];
  const legacyLinks = pid
    ? rows<{ offeringId: number; legacyOfferingId: number }>(
        db,
        "SELECT l.offering_id offeringId,l.legacy_offering_id legacyOfferingId FROM legacy_offering_links l JOIN offerings o ON o.id=l.offering_id WHERE o.program_id=?",
        pid,
      )
    : [];
  const coverIds = new Set(
    pid
      ? rows<{ id: number }>(
          db,
          "SELECT c.offering_id id FROM offering_covers c JOIN offerings o ON o.id=c.offering_id WHERE o.program_id=?",
          pid,
        ).map((row) => row.id)
      : [],
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
      batchError =
        e instanceof Error
          ? e.message
          : tr("Prévia indisponível.", "Preview unavailable.");
    }
  }
  const tabs = [
    { key: "structure", label: tr("Visão geral", "Overview") },
    { key: "cohorts", label: tr("Turmas", "Cohorts") },
    {
      key: "curriculum",
      label: tr("Semestres e currículo", "Semesters and curriculum"),
    },
    { key: "subjects", label: tr("Disciplinas", "Subjects") },
    {
      key: "offerings",
      label: tr("Turmas da disciplina", "Subject offerings"),
    },
    { key: "schedule", label: tr("Horários", "Schedules") },
    { key: "enrollments", label: tr("Estudantes", "Students") },
    { key: "managers", label: tr("Gestores", "Managers") },
  ];
  const activePeriod = cohortPeriodsAll.find((item) => item.state === "active");
  return (
    <ConsoleShell
      title={
        contextual && program
          ? program.name
          : admin
            ? tr("Estrutura acadêmica", "Academic structure")
            : tr("Gestão acadêmica", "Academic management")
      }
      kicker={
        admin
          ? tr("ADMINISTRAÇÃO / CURSO", "ADMINISTRATION / PROGRAM")
          : tr("Gestão · escopos delegados", "Management · delegated scopes")
      }
      name={name}
      admin={admin}
      active={admin ? "institutions" : undefined}
      message={message}
      error={error}
    >
      {contextual ? (
        <nav
          className="admin-breadcrumb"
          aria-label={tr("Caminho", "Breadcrumb")}
        >
          <Link href="/control/institutions">
            <UiCopy pt="Instituições" en="Institutions" />
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/control/institutions/${institutionId}`}>
            {institution}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{program?.name}</span>
        </nav>
      ) : null}
      {programs.length ? (
        <>
          {contextual && canStructure ? (
            <section className="v2-card">
              <h2>
                <UiCopy pt="Dados do curso" en="Course details" />
              </h2>
              <form action={controlAction} className="v2-fields">
                <HiddenContext
                  returnTo={path}
                  intent="programDetails"
                  id={pid}
                />
                <label>
                  <UiCopy pt="Nome do curso" en="Course name" />
                  <input name="name" defaultValue={program.name} required />
                </label>
                <label>
                  <UiCopy pt="Nome curto" en="Short name" />
                  <input
                    name="shortName"
                    defaultValue={programShortName ?? ""}
                    placeholder="ADS"
                    required
                  />
                </label>
                <button>
                  <UiCopy pt="Salvar curso" en="Save course" />
                </button>
              </form>
            </section>
          ) : null}
          {!contextual ? (
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
          ) : null}
          <div className="v2-context" role="status">
            <strong>
              {institution} / {program.name}
            </strong>
            <span>
              <UiCopy pt="Período atual:" en="Current period:" />{" "}
              {activePeriod?.name ?? tr("a definir", "not set")}
            </span>
            <span>
              <UiCopy pt="Turmas:" en="Cohorts:" /> {cohorts.length} ·{" "}
              <UiCopy pt="Semestres:" en="Semesters:" /> {semesters.length}
            </span>
          </div>
          <div className={contextual ? "admin-course-workspace" : undefined}>
            <nav
              className="v2-tabs"
              aria-label={tr("Áreas do curso", "Program sections")}
            >
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  href={sectionPath(t.key)}
                  aria-current={section === t.key ? "page" : undefined}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="admin-course-content">
              {section === "structure" ? (
                <section>
                  <h2>
                    <UiCopy pt="Este curso" en="This course" />
                  </h2>
                  <p>
                    <UiCopy
                      pt="Abra uma área do curso para administrar turmas, currículo, horários ou estudantes."
                      en="Open a course area to manage cohorts, curriculum, schedules or students."
                    />
                  </p>
                  <div className="admin-overview-facts">
                    <span>
                      <strong>{cohorts.length}</strong>
                      <UiCopy pt="turmas" en="cohorts" />
                    </span>
                    <span>
                      <strong>{semesters.length}</strong>
                      <UiCopy pt="semestres" en="semesters" />
                    </span>
                    <span>
                      <strong>{offerings.length}</strong>
                      <UiCopy
                        pt="turmas da disciplina"
                        en="subject offerings"
                      />
                    </span>
                  </div>
                </section>
              ) : null}
              {section === "cohorts" ? (
                <>
                  <h2>
                    <UiCopy pt="Turmas de estudantes" en="Student cohorts" />
                  </h2>
                  <Help>
                    <UiCopy
                      pt="Curso é a formação. Turma reúne estudantes de um curso, currículo e turno. Arquivar preserva vínculos; excluir só funciona quando o registro não tem dependências."
                      en="A course is the program of study. A cohort groups students by course, curriculum and shift. Archiving preserves links; deletion works only when the record has no dependencies."
                    />
                  </Help>
                  {admin ? (
                    <p>
                      <Link
                        href={`/control/institutions/${institutionId}?area=shifts`}
                      >
                        <UiCopy
                          pt="Gerenciar turnos da instituição →"
                          en="Manage institution shifts →"
                        />
                      </Link>
                    </p>
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
                  <h2>
                    <UiCopy
                      pt="Currículo e períodos"
                      en="Curriculum and periods"
                    />
                  </h2>
                  <Help>
                    <UiCopy
                      pt="Semestre curricular é a posição no curso (1º, 2º...). Período letivo é a janela no calendário (por exemplo, 2030.1). A turma conecta os dois sem misturá-los."
                      en="A curriculum semester is a position in the course (first, second and so on). An academic period is a calendar window (for example, 2030.1). A cohort links the two without mixing them."
                    />
                  </Help>
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
                  <h3>
                    <UiCopy pt="Semestres" en="Semesters" />
                  </h3>
                  <p>
                    {semesters.map((s) => s.name).join(" · ") ||
                      "Nenhum semestre."}
                  </p>
                  <h3>
                    <UiCopy
                      pt="Períodos desta turma"
                      en="Periods for this cohort"
                    />
                  </h3>
                  <div className="v2-list">
                    {cohortPeriods.map((cp) => (
                      <div key={cp.id} className="v2-row">
                        {cp.name} · {cp.state}
                      </div>
                    ))}
                  </div>
                  {admin ? (
                    <p>
                      <Link
                        href={
                          contextual
                            ? `/control/institutions/${institutionId}/courses/${pid}/transition`
                            : "/control/transition"
                        }
                      >
                        <UiCopy
                          pt="Preparar próximo semestre →"
                          en="Prepare next semester →"
                        />
                      </Link>
                    </p>
                  ) : (
                    <p>
                      <Link href={`/gestao/transition?program=${pid}`}>
                        <UiCopy
                          pt="Preparar transição →"
                          en="Prepare transition →"
                        />
                      </Link>
                    </p>
                  )}
                </>
              ) : null}
              {section === "subjects" ? (
                <section>
                  <h2>
                    <UiCopy pt="Disciplinas" en="Subjects" />
                  </h2>
                  <p>
                    <UiCopy
                      pt="As disciplinas pertencem à instituição. Associe cada uma ao semestre na área Semestres e currículo."
                      en="Subjects belong to the institution. Assign each one to a semester in Semesters and curriculum."
                    />
                  </p>
                  <div className="v2-list">
                    {subjects.map((subject) => (
                      <div className="v2-row" key={subject.id}>
                        {subject.name}
                      </div>
                    ))}
                  </div>
                  {admin ? (
                    <Link
                      href={`/control/institutions/${institutionId}?area=subjects`}
                    >
                      <UiCopy
                        pt="Gerenciar disciplinas da instituição →"
                        en="Manage institution subjects →"
                      />
                    </Link>
                  ) : null}
                </section>
              ) : null}
              {section === "managers" ? (
                <section>
                  <h2>
                    <UiCopy
                      pt="Gestores deste curso"
                      en="Managers of this course"
                    />
                  </h2>
                  <p>
                    <UiCopy
                      pt="Responsabilidades são concedidas por pessoa e escopo."
                      en="Responsibilities are granted by person and scope."
                    />
                  </p>
                  {admin ? (
                    <Link href="/control/grants">
                      <UiCopy
                        pt="Gerenciar responsabilidades →"
                        en="Manage responsibilities →"
                      />
                    </Link>
                  ) : (
                    <p>
                      <UiCopy
                        pt="Somente o Admin pode delegar responsabilidades."
                        en="Only the Admin may delegate responsibilities."
                      />
                    </p>
                  )}
                </section>
              ) : null}
              {section === "offerings" ? (
                <>
                  <h2>
                    <UiCopy pt="Turmas da disciplina" en="Subject offerings" />
                  </h2>
                  <Help>
                    <UiCopy
                      pt="Uma turma da disciplina é a oferta concreta em um período letivo. Cada novo período e cada repetição usam uma oferta nova; a anterior fica no histórico."
                      en="A subject offering is the concrete class in an academic period. Each new period and repeat uses a new offering; the previous one remains in history."
                    />
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
                        <Select
                          name="periodId"
                          label="Período"
                          items={periods}
                        />
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
                          {o.name} · {o.period}{" "}
                          {o.archived_at ? "· Arquivada" : ""}
                        </span>
                        {canManage(db, actor, "manage_academics", {
                          kind: "offering",
                          id: o.id,
                        }) ? (
                          <AdminActionPanel
                            title={
                              coverIds.has(o.id)
                                ? "Trocar capa"
                                : "Adicionar capa"
                            }
                          >
                            <form action={controlAction} className="v2-fields">
                              <HiddenContext
                                returnTo={path}
                                intent="offeringCover"
                                offeringId={o.id}
                              />
                              <p>
                                <UiCopy
                                  pt="A imagem aparece no cabeçalho e no cartão da disciplina. A capa do Classroom não é copiada automaticamente."
                                  en="The image appears in the subject header and card. The Classroom cover is not copied automatically."
                                />
                              </p>
                              <ImageUploadPreview
                                name="cover"
                                label="Imagem PNG, JPEG ou WebP · até 5 MiB"
                                currentSrc={
                                  coverIds.has(o.id)
                                    ? `/control/offering-cover/${o.id}`
                                    : undefined
                                }
                          alt={tr("Capa atual ou prévia da disciplina", "Current cover or subject preview")}
                                maxMiB={5}
                              />
                              <button>
                                <UiCopy pt="Salvar capa" en="Save cover" />
                              </button>
                            </form>
                            {coverIds.has(o.id) ? (
                              <form
                                action={controlAction}
                                className="v2-fields"
                              >
                                <HiddenContext
                                  returnTo={path}
                                  intent="offeringCoverRemove"
                                  offeringId={o.id}
                                />
                                <ConfirmSubmitButton
                                  type="submit"
                                  className="secondary-button"
                        confirmation={tr("Remover a capa desta disciplina e restaurar o visual padrão?", "Remove this subject cover and restore the default appearance?")}
                                >
                                  <UiCopy pt="Remover capa" en="Remove cover" />
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </AdminActionPanel>
                        ) : null}
                        {admin && contextual ? (
                          <AdminActionPanel title="Ligar à turma V1">
                            <p>
                              <UiCopy
                                pt="Confirme manualmente a turma do app diário que representa esta oferta. Nenhum vínculo é inferido pelo número do registro."
                                en="Manually confirm the daily app class that represents this offering. No link is inferred from the record number."
                              />
                            </p>
                            <form action={controlAction} className="v2-fields">
                              <HiddenContext
                                returnTo={path}
                                intent="legacyOfferingLink"
                                offeringId={o.id}
                              />
                              <label>
                                <UiCopy
                                  pt="Turma do app diário"
                                  en="Class in the daily app"
                                />
                                <select
                                  name="legacyOfferingId"
                                  defaultValue={
                                    legacyLinks.find(
                                      (link) => link.offeringId === o.id,
                                    )?.legacyOfferingId ?? ""
                                  }
                                  required
                                >
                                  <option value="">
                                    <UiCopy
                                      pt="Selecione pelo nome e período"
                                      en="Select by name and period"
                                    />
                                  </option>
                                  {legacyOfferings.map((legacy) => (
                                    <option
                                      key={legacy.offeringId}
                                      value={legacy.offeringId}
                                    >
                                      {legacy.subjectName} ·{" "}
                                      {legacy.programName} ·{" "}
                                      {legacy.periodLabel}
                                      {legacy.classGroup
                                        ? ` · ${legacy.classGroup}`
                                        : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button>
                                <UiCopy
                                  pt="Confirmar ligação"
                                  en="Confirm link"
                                />
                              </button>
                            </form>
                          </AdminActionPanel>
                        ) : null}
                        {canStructure &&
                        o.state === "planned" &&
                        !o.archived_at ? (
                          <details>
                            <summary>
                              <UiCopy
                                pt="Editar oferta preparada"
                                en="Edit prepared offering"
                              />
                            </summary>
                            <form action={controlAction} className="v2-fields">
                              <HiddenContext
                                returnTo={path}
                                intent="edit"
                                entity="offerings"
                                id={o.id}
                              />
                              <label>
                                <UiCopy pt="Professor" en="Instructor" />
                                <select
                                  name="instructorId"
                                  defaultValue={o.instructorId ?? ""}
                                >
                                  <option value="">
                                    <UiCopy pt="Não definido" en="Not set" />
                                  </option>
                                  {option(instructors)}
                                </select>
                              </label>
                              <label>
                                <UiCopy pt="Turno" en="Shift" />
                                <select
                                  name="shiftId"
                                  defaultValue={o.shiftId ?? ""}
                                >
                                  <option value="">
                                    <UiCopy pt="Não definido" en="Not set" />
                                  </option>
                                  {option(shifts)}
                                </select>
                              </label>
                              <label>
                                <UiCopy pt="Grupo" en="Group" />
                                <input
                                  name="classGroup"
                                  defaultValue={o.classGroup ?? ""}
                                />
                              </label>
                              <button>
                                <UiCopy
                                  pt="Salvar alterações"
                                  en="Save changes"
                                />
                              </button>
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
                              operation={
                                o.archived_at ? "reactivate" : "archive"
                              }
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
                  <h2>
                    <UiCopy pt="Horários" en="Schedules" />
                  </h2>
                  <p>
                    <UiCopy
                      pt="Edite todos os blocos de uma turma da disciplina de uma vez. Os dias e horários existentes aparecem antes de salvar."
                      en="Edit all schedule slots for an offering together. Existing days and times appear before saving."
                    />
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
                        ? tr(
                            "Sem permissão para editar horários.",
                            "You do not have permission to edit schedules.",
                          )
                        : tr(
                            "Crie primeiro uma turma da disciplina.",
                            "Create a subject offering first.",
                          )}
                    </p>
                  )}
                </>
              ) : null}
              {section === "enrollments" ? (
                <>
                  <h2>
                    <UiCopy pt="Matrículas" en="Enrollments" />
                  </h2>
                  <p>
                    <UiCopy
                      pt="Estudantes vinculados a este curso podem ser matriculados em uma turma da disciplina. O histórico anterior permanece."
                      en="Students linked to this course can be enrolled in a subject offering. Previous history remains."
                    />
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
                      <summary>
                        <UiCopy
                          pt="Matricular turma inteira"
                          en="Enroll entire cohort"
                        />
                      </summary>
                      <p>
                        <UiCopy
                          pt="Selecione uma turma e uma turma da disciplina vinculada para pré-visualizar o lote. Nenhuma matrícula é aplicada na prévia."
                          en="Select a cohort and linked subject offering to preview the batch. No enrollment is applied in the preview."
                        />
                      </p>
                      <form method="get" action={base} className="v2-fields">
                        <input type="hidden" name="program" value={pid} />
                        <input
                          type="hidden"
                          name="section"
                          value="enrollments"
                        />
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
                        <button>
                          <UiCopy pt="Pré-visualizar lote" en="Preview batch" />
                        </button>
                      </form>
                      {batchError ? (
                        <div
                          className="v2-message"
                          data-type="error"
                          role="alert"
                        >
                          {batchError}
                        </div>
                      ) : null}
                      {batchPreview ? (
                        <>
                          <p>
                            {batchPreview.total}{" "}
                            <UiCopy
                              pt="estudantes ativos na turma;"
                              en="active students in the cohort;"
                            />{" "}
                            {batchPreview.pending}{" "}
                            <UiCopy
                              pt="matrículas novas ou reativadas. O lote é atômico."
                              en="new or reactivated enrollments. The batch is atomic."
                            />
                          </p>
                          <form action={controlAction}>
                            <HiddenContext
                              returnTo={`${path}&batchCohort=${batchCohort}&batchOffering=${batchOffering}`}
                              intent="enrollCohort"
                              cohortId={batchCohort}
                              offeringId={batchOffering}
                            />
                            <label>
                              <UiCopy pt="Digite" en="Type" />{" "}
                              <strong>
                                <UiCopy pt="MATRICULAR" en="ENROLL" />{" "}
                                {batchPreview.pending}
                              </strong>
                              <input name="confirmation" required />
                            </label>
                            <button>
                              <UiCopy
                                pt="Aplicar matrículas em lote"
                                en="Apply batch enrollments"
                              />
                            </button>
                          </form>
                        </>
                      ) : null}
                    </details>
                  ) : (
                    <p>
                      <UiCopy
                        pt="Sem permissão para matrículas neste escopo."
                        en="No permission for enrollments in this scope."
                      />
                    </p>
                  )}
                  {canEnrollmentScoped ? (
                    <div className="v2-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>
                              <UiCopy pt="Estudante" en="Student" />
                            </th>
                            <th>
                              <UiCopy
                                pt="Turma da disciplina"
                                en="Subject offering"
                              />
                            </th>
                            <th>
                              <UiCopy pt="Origem" en="Source" />
                            </th>
                            <th>
                              <UiCopy pt="Ação" en="Action" />
                            </th>
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
                                      <button>
                                        <UiCopy pt="Retirar" en="Withdraw" />
                                      </button>
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
            </div>
          </div>
        </>
      ) : (
        <p>
          <UiCopy
            pt="Nenhum curso disponível no seu escopo de Gestão."
            en="No courses available in your management scope."
          />
        </p>
      )}
    </ConsoleShell>
  );
}
