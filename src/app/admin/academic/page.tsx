import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createInstructorAction,
  createDriveFolderAction,
  createCohortAction,
  createLocationAction,
  createOfferingAction,
  createPeriodAction,
  createProgramAction,
  createScheduleAction,
  createSubjectAction,
  createTimelineAction,
  setCurrentPeriodAction,
  updateClassroomIntegrationAction,
  updateInstructorAction,
  updateCohortAction,
  updateLocationAction,
  updateOfferingAction,
  updatePeriodAction,
  updateProgramAction,
  updateScheduleAction,
  updateSubjectAction,
  updateTimelineAction,
  updateNotebookIntegrationAction,
} from "@/app/admin/academic/actions";
import { getAdminAcademicData } from "@/lib/admin-academic";
import { requireAcademicAdministrator } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { getUiLanguage } from "@/lib/ui-language";
import { listCohorts } from "@/lib/academic-membership";
import { resolveAcademicAdminContext } from "@/lib/academic-authority";
import { getGoogleConnection } from "@/lib/google/connections";
import { getGoogleIntegrationAvailability } from "@/lib/google/config";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { isConfiguredDriveStorageAvailable } from "@/lib/google/storage-owner";
import {
  listClassroomCourses,
  type ClassroomCourse,
} from "@/lib/google/classroom";
import { listOfferingGoogleIntegrations } from "@/lib/google/offering-integrations";
import { resolveAcademicSettingsSection } from "@/lib/settings-navigation";

export const dynamic = "force-dynamic";

type FormAction = (formData: FormData) => void | Promise<void>;

function minutesInput(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function localDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function ActiveInput({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <input name="active" type="checkbox" defaultChecked={defaultChecked} />
  );
}

function RecordEditor({
  id,
  label,
  action,
  children,
}: {
  id: number;
  label: string;
  action: FormAction;
  children: React.ReactNode;
}) {
  return (
    <details className="admin-record-editor">
      <summary>[ {label} ]</summary>
      <form action={action} className="admin-edit-form">
        <input type="hidden" name="id" value={id} />
        {children}
        <button type="submit">{label}</button>
      </form>
    </details>
  );
}

export default async function AdminAcademicPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    programId?: string;
    cohortId?: string;
    googleCourses?: string;
    section?: string;
  }>;
}) {
  const actor = await requireAcademicAdministrator();
  const parameters = await searchParams;
  const parseId = (value: string | undefined) =>
    value && /^\d+$/.test(value) ? Number(value) : null;
  let context;
  try {
    context = resolveAcademicAdminContext(
      actor.id,
      parseId(parameters.programId),
      parseId(parameters.cohortId),
    );
  } catch {
    redirect("/admin/academic");
  }
  const rawData = getAdminAcademicData();
  const offerings = rawData.offerings.filter(
    ({ programId }) => programId === context.selectedProgramId,
  );
  const offeringIds = new Set(offerings.map(({ id }) => id));
  const data = {
    ...rawData,
    offerings,
    scheduleSlots: rawData.scheduleSlots.filter(({ offeringId }) =>
      offeringIds.has(offeringId),
    ),
    timelineEvents: rawData.timelineEvents.filter(({ offeringId }) =>
      offeringIds.has(offeringId),
    ),
  };
  const cohorts = listCohorts().filter(
    ({ id, programId }) =>
      programId === context.selectedProgramId &&
      (context.selectedCohortId === null || id === context.selectedCohortId) &&
      context.cohorts.some((cohort) => cohort.id === id),
  );
  const manageablePrograms = rawData.programs.filter(({ id }) =>
    context.programs.some((program) => program.id === id),
  );
  const canManageGlobal = context.authority.role === "admin";
  const canManageProgram =
    context.authority.role === "admin" ||
    context.authority.role === "moderator";
  const section = resolveAcademicSettingsSection(parameters.section, {
    global: canManageGlobal,
    program: canManageProgram,
  });
  const sectionHref = (target: string) => {
    const query = new URLSearchParams({ section: target });
    if (context.selectedProgramId !== null) {
      query.set("programId", String(context.selectedProgramId));
    }
    if (context.selectedCohortId !== null) {
      query.set("cohortId", String(context.selectedCohortId));
    }
    return `/admin/academic?${query.toString()}`;
  };
  const googleIntegrations = new Map(
    listOfferingGoogleIntegrations(offerings.map(({ id }) => id)).map(
      (integration) => [integration.offeringId, integration],
    ),
  );
  const googleConfigured = getGoogleIntegrationAvailability().configured;
  const googleConnected = getGoogleConnection(actor.id)?.status === "connected";
  const centralDriveAvailable = isConfiguredDriveStorageAvailable();
  let classroomCourses: ClassroomCourse[] | null = null;
  let classroomCoursesUnavailable = false;
  if (parameters.googleCourses === "1" && googleConfigured && googleConnected) {
    try {
      classroomCourses = await listClassroomCourses(actor.id);
    } catch {
      classroomCoursesUnavailable = true;
    }
  }
  const { admin } = getTranslations(getUiLanguage());
  const status = parameters.status;

  return (
    <div className="admin-shell academic-admin-shell">
      <header className="admin-heading">
        <div>
          <span>{admin.system}</span>
          <h1>{admin.academicTitle}</h1>
          <p className="page-description">
            <UiCopy
              pt="Cadastre a estrutura em etapas e trabalhe sempre dentro do contexto selecionado."
              en="Set up the structure step by step and work within the selected context."
            />
          </p>
        </div>
        <Link href="/admin">← {admin.back}</Link>
      </header>

      <nav
        className="section-tabs admin-section-nav"
        aria-label="Áreas acadêmicas"
      >
        {canManageGlobal ? (
          <Link
            href={sectionHref("programs")}
            aria-current={section === "programs" ? "page" : undefined}
          >
            Programas
          </Link>
        ) : null}
        {canManageGlobal ? (
          <Link
            href={sectionHref("periods")}
            aria-current={section === "periods" ? "page" : undefined}
          >
            <UiCopy pt="Períodos" en="Periods" />
          </Link>
        ) : null}
        <Link
          href={sectionHref("cohorts")}
          aria-current={section === "cohorts" ? "page" : undefined}
        >
          Turmas
        </Link>
        {canManageGlobal ? (
          <Link
            href={sectionHref("subjects")}
            aria-current={section === "subjects" ? "page" : undefined}
          >
            <UiCopy pt="Disciplinas" en="Subjects" />
          </Link>
        ) : null}
        {canManageProgram ? (
          <Link
            href={sectionHref("offerings")}
            aria-current={section === "offerings" ? "page" : undefined}
          >
            Ofertas
          </Link>
        ) : null}
        {canManageProgram ? (
          <Link
            href={sectionHref("integrations")}
            aria-current={section === "integrations" ? "page" : undefined}
          >
            <UiCopy pt="Integrações" en="Integrations" />
          </Link>
        ) : null}
        {canManageProgram ? (
          <Link
            href={sectionHref("schedules")}
            aria-current={section === "schedules" ? "page" : undefined}
          >
            <UiCopy pt="Horários" en="Schedules" />
          </Link>
        ) : null}
        {canManageGlobal ? (
          <Link
            href={sectionHref("others")}
            aria-current={section === "others" ? "page" : undefined}
          >
            Outros
          </Link>
        ) : null}
      </nav>

      {status === "error" ? (
        <p className="admin-feedback form-error" role="alert">
          {admin.actionError}
        </p>
      ) : null}
      {status === "ok" ? (
        <p className="admin-feedback feedback-banner is-success" role="status">
          {admin.actionSuccess}
        </p>
      ) : null}

      <form method="get" className="admin-context-selector">
        <input type="hidden" name="section" value={section} />
        <label>
          {admin.program}
          <select
            name="programId"
            defaultValue={context.selectedProgramId ?? ""}
            required
          >
            {context.programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {admin.cohort}
          <select name="cohortId" defaultValue={context.selectedCohortId ?? ""}>
            <option value="">{admin.allCohorts}</option>
            {context.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{admin.applyContext}</button>
      </form>

      {canManageGlobal && section === "periods" ? (
        <section className="admin-panel current-period-panel">
          <div className="section-heading">
            <span className="panel-index">00</span>
            <h2>{admin.currentPeriod}</h2>
          </div>
          <form action={setCurrentPeriodAction} className="admin-inline-form">
            <label>
              {admin.period}
              <select
                name="periodId"
                defaultValue={data.currentPeriodId ?? ""}
                required
              >
                <option value="" disabled>
                  {admin.selectPeriod}
                </option>
                {data.periods
                  .filter((period) => Boolean(period.active))
                  .map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit">{admin.saveCurrentPeriod}</button>
          </form>
        </section>
      ) : null}

      <div className="admin-academic-grid">
        {canManageGlobal && section === "programs" ? (
          <section className="admin-panel" id="programas">
            <div className="section-heading">
              <span className="panel-index">01</span>
              <h2>{admin.programs}</h2>
              <span>{data.programs.length}</span>
            </div>
            <form action={createProgramAction} className="admin-create-form">
              <label>
                {admin.code}
                <input name="code" maxLength={40} />
              </label>
              <label>
                {admin.name}
                <input name="name" maxLength={160} required />
              </label>
              <label>
                {admin.shortName}
                <input name="shortName" maxLength={40} />
              </label>
              <label>
                {admin.active}
                <ActiveInput />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.programs.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.code ?? "—"}</span>
                    <strong>{item.name}</strong>
                    <span>{item.active ? admin.active : admin.disabled}</span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateProgramAction}
                  >
                    <label>
                      {admin.code}
                      <input
                        name="code"
                        defaultValue={item.code ?? ""}
                        maxLength={40}
                      />
                    </label>
                    <label>
                      {admin.name}
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label>
                      {admin.shortName}
                      <input
                        name="shortName"
                        defaultValue={item.shortName ?? ""}
                      />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={Boolean(item.active)} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {section === "cohorts" ? (
          <section className="admin-panel" id="turmas">
            <div className="section-heading">
              <span className="panel-index">02</span>
              <h2>{admin.cohorts}</h2>
              <span>{cohorts.length}</span>
            </div>
            {canManageProgram ? (
              <form action={createCohortAction} className="admin-create-form">
                <label>
                  {admin.program}
                  <select name="programId" required defaultValue="">
                    <option value="" disabled>
                      {admin.selectProgram}
                    </option>
                    {manageablePrograms.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {admin.code}
                  <input name="code" maxLength={40} />
                </label>
                <label>
                  {admin.name}
                  <input name="name" maxLength={160} required />
                </label>
                <label>
                  {admin.active}
                  <ActiveInput />
                </label>
                <button>{admin.create}</button>
              </form>
            ) : null}
            <ol className="admin-record-list">
              {cohorts.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.code ?? "—"}</span>
                    <strong>{item.name}</strong>
                    <span>{item.programName}</span>
                    <span>{item.active ? admin.active : admin.disabled}</span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateCohortAction}
                  >
                    <label>
                      {admin.program}
                      <select name="programId" defaultValue={item.programId}>
                        {manageablePrograms.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {admin.code}
                      <input name="code" defaultValue={item.code ?? ""} />
                    </label>
                    <label>
                      {admin.name}
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={item.active} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageGlobal && section === "others" ? (
          <section className="admin-panel" id="professores">
            <div className="section-heading">
              <span className="panel-index">02</span>
              <h2>{admin.instructors}</h2>
              <span>{data.instructors.length}</span>
            </div>
            <form action={createInstructorAction} className="admin-create-form">
              <label>
                {admin.code}
                <input name="code" maxLength={40} />
              </label>
              <label>
                {admin.name}
                <input name="name" required />
              </label>
              <label>
                {admin.displayName}
                <input name="displayName" />
              </label>
              <label>
                {admin.active}
                <ActiveInput />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.instructors.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.code ?? "—"}</span>
                    <strong>{item.displayName ?? item.name}</strong>
                    <span>{item.active ? admin.active : admin.disabled}</span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateInstructorAction}
                  >
                    <label>
                      {admin.code}
                      <input name="code" defaultValue={item.code ?? ""} />
                    </label>
                    <label>
                      {admin.name}
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label>
                      {admin.displayName}
                      <input
                        name="displayName"
                        defaultValue={item.displayName ?? ""}
                      />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={Boolean(item.active)} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageGlobal && section === "periods" ? (
          <section className="admin-panel" id="periodos">
            <div className="section-heading">
              <span className="panel-index">03</span>
              <h2>{admin.periods}</h2>
              <span>{data.periods.length}</span>
            </div>
            <form action={createPeriodAction} className="admin-create-form">
              <label>
                {admin.label}
                <input name="label" required />
              </label>
              <label>
                {admin.startsOn}
                <input name="startsOn" type="date" required />
              </label>
              <label>
                {admin.endsOn}
                <input name="endsOn" type="date" required />
              </label>
              <label>
                {admin.active}
                <ActiveInput />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.periods.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.id}</span>
                    <strong>{item.label}</strong>
                    <span>
                      {item.startsOn}—{item.endsOn}
                    </span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updatePeriodAction}
                  >
                    <label>
                      {admin.label}
                      <input name="label" defaultValue={item.label} required />
                    </label>
                    <label>
                      {admin.startsOn}
                      <input
                        name="startsOn"
                        type="date"
                        defaultValue={item.startsOn}
                        required
                      />
                    </label>
                    <label>
                      {admin.endsOn}
                      <input
                        name="endsOn"
                        type="date"
                        defaultValue={item.endsOn}
                        required
                      />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={Boolean(item.active)} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageGlobal && section === "others" ? (
          <section className="admin-panel" id="locais">
            <div className="section-heading">
              <span className="panel-index">04</span>
              <h2>{admin.locations}</h2>
              <span>{data.locations.length}</span>
            </div>
            <form action={createLocationAction} className="admin-create-form">
              <label>
                {admin.name}
                <input name="name" required />
              </label>
              <label>
                {admin.campus}
                <input name="campus" />
              </label>
              <label>
                {admin.building}
                <input name="building" />
              </label>
              <label>
                {admin.room}
                <input name="room" />
              </label>
              <label>
                {admin.description}
                <input name="description" />
              </label>
              <label>
                {admin.active}
                <ActiveInput />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.locations.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.id}</span>
                    <strong>{item.name}</strong>
                    <span>
                      {[item.campus, item.building, item.room]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateLocationAction}
                  >
                    <label>
                      {admin.name}
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label>
                      {admin.campus}
                      <input name="campus" defaultValue={item.campus ?? ""} />
                    </label>
                    <label>
                      {admin.building}
                      <input
                        name="building"
                        defaultValue={item.building ?? ""}
                      />
                    </label>
                    <label>
                      {admin.room}
                      <input name="room" defaultValue={item.room ?? ""} />
                    </label>
                    <label>
                      {admin.description}
                      <input
                        name="description"
                        defaultValue={item.description ?? ""}
                      />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={Boolean(item.active)} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageGlobal && section === "subjects" ? (
          <section className="admin-panel" id="disciplinas">
            <div className="section-heading">
              <span className="panel-index">05</span>
              <h2>{admin.subjects}</h2>
              <span>{data.subjects.length}</span>
            </div>
            <form action={createSubjectAction} className="admin-create-form">
              <label>
                {admin.code}
                <input name="code" />
              </label>
              <label>
                {admin.name}
                <input name="name" required />
              </label>
              <label>
                {admin.shortName}
                <input name="shortName" />
              </label>
              <label>
                {admin.active}
                <ActiveInput />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.subjects.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>{item.code ?? "—"}</span>
                    <strong>{item.name}</strong>
                    <span>{item.active ? admin.active : admin.disabled}</span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateSubjectAction}
                  >
                    <label>
                      {admin.code}
                      <input name="code" defaultValue={item.code ?? ""} />
                    </label>
                    <label>
                      {admin.name}
                      <input name="name" defaultValue={item.name} required />
                    </label>
                    <label>
                      {admin.shortName}
                      <input
                        name="shortName"
                        defaultValue={item.shortName ?? ""}
                      />
                    </label>
                    <label>
                      {admin.active}
                      <ActiveInput defaultChecked={Boolean(item.active)} />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageProgram &&
        (section === "offerings" || section === "integrations") ? (
          <section className="admin-panel wide-panel" id="ofertas">
            <div className="section-heading">
              <span className="panel-index">06</span>
              <h2>
                {section === "integrations"
                  ? admin.googleIntegration
                  : admin.offerings}
              </h2>
              <span>{data.offerings.length}</span>
            </div>
            {section === "offerings" ? (
              <form
                action={createOfferingAction}
                className="admin-create-form relation-form"
              >
                <label>
                  {admin.subject}
                  <select name="subjectId" required>
                    {data.subjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {admin.program}
                  <select name="programId" required>
                    {manageablePrograms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {admin.period}
                  <select name="academicPeriodId" required>
                    {data.periods.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {admin.instructor}
                  <select name="instructorId">
                    <option value="">—</option>
                    {data.instructors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.displayName ?? item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {admin.classGroup}
                  <input name="classGroup" />
                </label>
                <label>
                  {admin.curriculumTerm}
                  <input name="curriculumTerm" />
                </label>
                <label>
                  {admin.status}
                  <select name="status" defaultValue="planned">
                    <option value="planned">planned</option>
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </label>
                <button>{admin.create}</button>
              </form>
            ) : null}
            {section === "integrations" ? (
              <form method="get" className="admin-inline-form">
                <input type="hidden" name="section" value="integrations" />
                {context.selectedProgramId !== null ? (
                  <input
                    type="hidden"
                    name="programId"
                    value={context.selectedProgramId}
                  />
                ) : null}
                {context.selectedCohortId !== null ? (
                  <input
                    type="hidden"
                    name="cohortId"
                    value={context.selectedCohortId}
                  />
                ) : null}
                <input type="hidden" name="googleCourses" value="1" />
                <button
                  type="submit"
                  disabled={!googleConfigured || !googleConnected}
                >
                  {admin.loadClassroomCourses}
                </button>
                {!googleConnected ? (
                  <span>{admin.googleAccountRequired}</span>
                ) : null}
                {classroomCoursesUnavailable ? (
                  <span role="status">{admin.classroomUnavailable}</span>
                ) : null}
                {classroomCourses !== null && classroomCourses.length === 0 ? (
                  <span role="status">{admin.noClassroomCourses}</span>
                ) : null}
              </form>
            ) : null}
            <ol className="admin-record-list">
              {data.offerings.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>#{item.id}</span>
                    <strong>
                      {data.subjects.find(({ id }) => id === item.subjectId)
                        ?.name ?? "—"}
                    </strong>
                    <span>{item.status}</span>
                  </div>
                  {section === "offerings" ? (
                    <RecordEditor
                      id={item.id}
                      label={admin.update}
                      action={updateOfferingAction}
                    >
                      <label>
                        {admin.subject}
                        <select name="subjectId" defaultValue={item.subjectId}>
                          {data.subjects.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {admin.program}
                        <select name="programId" defaultValue={item.programId}>
                          {manageablePrograms.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {admin.period}
                        <select
                          name="academicPeriodId"
                          defaultValue={item.academicPeriodId}
                        >
                          {data.periods.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {admin.instructor}
                        <select
                          name="instructorId"
                          defaultValue={item.instructorId ?? ""}
                        >
                          <option value="">—</option>
                          {data.instructors.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.displayName ?? record.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {admin.classGroup}
                        <input
                          name="classGroup"
                          defaultValue={item.classGroup ?? ""}
                        />
                      </label>
                      <label>
                        {admin.curriculumTerm}
                        <input
                          name="curriculumTerm"
                          defaultValue={item.curriculumTerm ?? ""}
                        />
                      </label>
                      <label>
                        {admin.status}
                        <select name="status" defaultValue={item.status}>
                          <option value="planned">planned</option>
                          <option value="active">active</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </label>
                    </RecordEditor>
                  ) : null}
                  {section === "integrations" ? (
                    <details className="admin-record-editor">
                      <summary className="integration-summary">
                        <span>{admin.googleIntegration}</span>
                        <span className="integration-statuses">
                          <span
                            data-connected={Boolean(
                              googleIntegrations.get(item.id)?.driveFolderId,
                            )}
                          >
                            DRIVE
                          </span>
                          <span
                            data-connected={Boolean(
                              googleIntegrations.get(item.id)?.notebookUrl,
                            )}
                          >
                            NOTEBOOK
                          </span>
                          <span
                            data-connected={Boolean(
                              googleIntegrations.get(item.id)
                                ?.classroomCourseId,
                            )}
                          >
                            CLASSROOM
                          </span>
                        </span>
                      </summary>
                      <form
                        action={updateNotebookIntegrationAction}
                        className="admin-edit-form"
                      >
                        <input
                          type="hidden"
                          name="offeringId"
                          value={item.id}
                        />
                        <label>
                          {admin.notebookUrl}
                          <input
                            name="notebookUrl"
                            type="url"
                            defaultValue={
                              googleIntegrations.get(item.id)?.notebookUrl ?? ""
                            }
                            placeholder="https://notebook.google.com/..."
                          />
                        </label>
                        <button type="submit">
                          {admin.saveNotebookMapping}
                        </button>
                      </form>
                      <form
                        action={updateClassroomIntegrationAction}
                        className="admin-edit-form"
                      >
                        <input
                          type="hidden"
                          name="offeringId"
                          value={item.id}
                        />
                        {classroomCourses !== null &&
                        classroomCourses.length > 0 ? (
                          <label>
                            {admin.classroomCourse}
                            <select
                              name="classroomCourseId"
                              defaultValue={
                                googleIntegrations.get(item.id)
                                  ?.classroomCourseId ?? ""
                              }
                            >
                              <option value="">
                                {admin.clearClassroomMapping}
                              </option>
                              {googleIntegrations.get(item.id)
                                ?.classroomCourseId &&
                              !classroomCourses.some(
                                ({ id }) =>
                                  id ===
                                  googleIntegrations.get(item.id)
                                    ?.classroomCourseId,
                              ) ? (
                                <option
                                  value={
                                    googleIntegrations.get(item.id)
                                      ?.classroomCourseId ?? ""
                                  }
                                >
                                  {googleIntegrations.get(item.id)
                                    ?.classroomCourseName ??
                                    admin.configuredClassroomCourse}
                                </option>
                              ) : null}
                              {classroomCourses.map((course) => (
                                <option key={course.id} value={course.id}>
                                  {course.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : classroomCoursesUnavailable ||
                          (classroomCourses !== null &&
                            classroomCourses.length === 0) ? (
                          <>
                            <label>
                              {admin.manualClassroomCourseId}
                              <input
                                name="manualClassroomCourseId"
                                defaultValue={
                                  googleIntegrations.get(item.id)
                                    ?.classroomCourseId ?? ""
                                }
                              />
                            </label>
                            <label>
                              {admin.manualClassroomCourseName}
                              <input
                                name="manualClassroomCourseName"
                                defaultValue={
                                  googleIntegrations.get(item.id)
                                    ?.classroomCourseName ?? ""
                                }
                              />
                            </label>
                          </>
                        ) : (
                          <span>
                            {googleIntegrations.get(item.id)
                              ?.classroomCourseName ??
                              admin.classroomNotConfigured}
                          </span>
                        )}
                        {classroomCourses !== null ||
                        classroomCoursesUnavailable ? (
                          <button type="submit">
                            {admin.saveClassroomMapping}
                          </button>
                        ) : null}
                        {classroomCourses !== null &&
                        classroomCourses.length > 0 ? (
                          <details className="classroom-manual-mapping">
                            <summary>{admin.manualClassroomMapping}</summary>
                            <p className="page-description">
                              {admin.manualClassroomMappingHelp}
                            </p>
                            <label>
                              {admin.manualClassroomCourseId}
                              <input
                                name="manualClassroomCourseId"
                                placeholder="123456789012"
                              />
                            </label>
                            <label>
                              {admin.manualClassroomCourseName}
                              <input
                                name="manualClassroomCourseName"
                                placeholder={
                                  googleIntegrations.get(item.id)
                                    ?.classroomCourseName ?? "POO — Turma B"
                                }
                              />
                            </label>
                            <small>{admin.manualClassroomMappingWarning}</small>
                          </details>
                        ) : null}
                      </form>
                      <form action={createDriveFolderAction}>
                        <input
                          type="hidden"
                          name="offeringId"
                          value={item.id}
                        />
                        {googleIntegrations.get(item.id)?.driveFolderId ? (
                          <input
                            type="hidden"
                            name="forceReprovision"
                            value="true"
                          />
                        ) : null}
                        <PendingSubmitButton
                          disabled={
                            !googleConfigured ||
                            (!googleConnected && !centralDriveAvailable)
                          }
                          pendingLabel={
                            googleIntegrations.get(item.id)?.driveFolderId
                              ? "Recriando estrutura…"
                              : "Criando estrutura…"
                          }
                        >
                          {googleIntegrations.get(item.id)?.driveFolderId
                            ? "Recriar estrutura do Drive"
                            : admin.createDriveFolder}
                        </PendingSubmitButton>
                        {googleIntegrations.get(item.id)?.driveFolderName ? (
                          <small>
                            Atual:{" "}
                            {googleIntegrations.get(item.id)?.driveFolderName}
                          </small>
                        ) : null}
                        {!googleConnected && !centralDriveAvailable ? (
                          <span>{admin.googleAccountRequired}</span>
                        ) : null}
                      </form>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageProgram && section === "schedules" ? (
          <section className="admin-panel wide-panel" id="horarios">
            <div className="section-heading">
              <span className="panel-index">07</span>
              <h2>{admin.scheduleSlots}</h2>
              <span>{data.scheduleSlots.length}</span>
            </div>
            <form
              action={createScheduleAction}
              className="admin-create-form relation-form"
            >
              <label>
                {admin.offerings}
                <select name="offeringId" required>
                  {data.offerings.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {admin.location}
                <select name="locationId">
                  <option value="">—</option>
                  {data.locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {admin.weekday}
                <input name="weekday" type="number" min="1" max="7" required />
              </label>
              <label>
                {admin.startTime}
                <input name="startsAt" type="time" required />
              </label>
              <label>
                {admin.endTime}
                <input name="endsAt" type="time" required />
              </label>
              <label>
                {admin.validFrom}
                <input name="validFrom" type="date" />
              </label>
              <label>
                {admin.validUntil}
                <input name="validUntil" type="date" />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.scheduleSlots.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>#{item.id}</span>
                    <strong>#{item.offeringId}</strong>
                    <span>
                      {item.weekday} / {minutesInput(item.startsAtMinutes)}—
                      {minutesInput(item.endsAtMinutes)}
                    </span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateScheduleAction}
                  >
                    <label>
                      {admin.offerings}
                      <select name="offeringId" defaultValue={item.offeringId}>
                        {data.offerings.map((record) => (
                          <option key={record.id} value={record.id}>
                            #{record.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {admin.location}
                      <select
                        name="locationId"
                        defaultValue={item.locationId ?? ""}
                      >
                        <option value="">—</option>
                        {data.locations.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {admin.weekday}
                      <input
                        name="weekday"
                        type="number"
                        min="1"
                        max="7"
                        defaultValue={item.weekday}
                      />
                    </label>
                    <label>
                      {admin.startTime}
                      <input
                        name="startsAt"
                        type="time"
                        defaultValue={minutesInput(item.startsAtMinutes)}
                      />
                    </label>
                    <label>
                      {admin.endTime}
                      <input
                        name="endsAt"
                        type="time"
                        defaultValue={minutesInput(item.endsAtMinutes)}
                      />
                    </label>
                    <label>
                      {admin.validFrom}
                      <input
                        name="validFrom"
                        type="date"
                        defaultValue={item.validFrom ?? ""}
                      />
                    </label>
                    <label>
                      {admin.validUntil}
                      <input
                        name="validUntil"
                        type="date"
                        defaultValue={item.validUntil ?? ""}
                      />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canManageGlobal && section === "others" ? (
          <section className="admin-panel wide-panel" id="eventos">
            <div className="section-heading">
              <span className="panel-index">08</span>
              <h2>{admin.timelineEvents}</h2>
              <span>{data.timelineEvents.length}</span>
            </div>
            <form
              action={createTimelineAction}
              className="admin-create-form relation-form"
            >
              <label>
                {admin.offerings}
                <select name="offeringId" required>
                  {data.offerings.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {admin.location}
                <select name="locationId">
                  <option value="">—</option>
                  {data.locations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {admin.type}
                <select name="type">
                  <option value="class">class</option>
                  <option value="academic_event">academic_event</option>
                  <option value="material">material</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label>
                {admin.titleLabel}
                <input name="title" required />
              </label>
              <label>
                {admin.description}
                <input name="description" />
              </label>
              <label>
                {admin.startsAt}
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                {admin.endsAt}
                <input name="endsAt" type="datetime-local" />
              </label>
              <button>{admin.create}</button>
            </form>
            <ol className="admin-record-list">
              {data.timelineEvents.map((item) => (
                <li key={item.id}>
                  <div className="admin-record-summary">
                    <span>#{item.id}</span>
                    <strong>{item.title}</strong>
                    <span>{item.type}</span>
                  </div>
                  <RecordEditor
                    id={item.id}
                    label={admin.update}
                    action={updateTimelineAction}
                  >
                    <label>
                      {admin.offerings}
                      <select name="offeringId" defaultValue={item.offeringId}>
                        {data.offerings.map((record) => (
                          <option key={record.id} value={record.id}>
                            #{record.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {admin.location}
                      <select
                        name="locationId"
                        defaultValue={item.locationId ?? ""}
                      >
                        <option value="">—</option>
                        {data.locations.map((record) => (
                          <option key={record.id} value={record.id}>
                            {record.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {admin.type}
                      <select name="type" defaultValue={item.type}>
                        <option value="class">class</option>
                        <option value="academic_event">academic_event</option>
                        <option value="material">material</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label>
                      {admin.titleLabel}
                      <input name="title" defaultValue={item.title} />
                    </label>
                    <label>
                      {admin.description}
                      <input
                        name="description"
                        defaultValue={item.description ?? ""}
                      />
                    </label>
                    <label>
                      {admin.startsAt}
                      <input
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={localDateTimeInput(item.startsAt)}
                      />
                    </label>
                    <label>
                      {admin.endsAt}
                      <input
                        name="endsAt"
                        type="datetime-local"
                        defaultValue={
                          item.endsAt ? localDateTimeInput(item.endsAt) : ""
                        }
                      />
                    </label>
                  </RecordEditor>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
