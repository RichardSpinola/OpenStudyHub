import { RemovalPanel } from "../../removal-panel";
import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { controlAction } from "../../actions";
import { AdminActionPanel } from "../../admin-action-panel";
import { ConsoleShell, HiddenContext } from "../../ui";
import { getUiLanguage } from "@/lib/ui-language";
import { uiText } from "@/lib/translations";

const collections = [
  {
    entity: "shifts",
    title: "Turnos",
    intent: "shift",
    fields: ["name", "code"],
  },
  {
    entity: "subjects",
    title: "Disciplinas",
    intent: "subject",
    fields: ["name", "code"],
  },
  {
    entity: "academic_periods",
    title: "Períodos letivos",
    intent: "period",
    fields: ["label", "startsOn", "endsOn"],
  },
  {
    entity: "instructors",
    title: "Professores",
    intent: "instructor",
    fields: ["name"],
  },
  {
    entity: "locations",
    title: "Salas",
    intent: "location",
    fields: ["name", "campus", "room"],
  },
] as const;
const labels: Record<string, string> = {
  name: "Nome",
  code: "Código",
  label: "Período (ex.: 2030.1)",
  startsOn: "Início",
  endsOn: "Fim",
  campus: "Campus",
  room: "Sala",
};
const labelsEn: Record<string, string> = {
  name: "Name",
  code: "Code",
  label: "Period (e.g. 2030.1)",
  startsOn: "Start",
  endsOn: "End",
  campus: "Campus",
  room: "Room",
};
const collectionTitlesEn: Record<string, string> = {
  shifts: "Shifts",
  subjects: "Subjects",
  academic_periods: "Academic periods",
  instructors: "Instructors",
  locations: "Rooms",
};
const optional = new Set(["code", "campus", "room"]);

export default async function Institution({
  params,
  searchParams,
}: {
  params: Promise<{ institutionId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; area?: string }>;
}) {
  const { institutionId: raw } = await params;
  const q = await searchParams;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  return withV2DbAsync(async (db) => {
    const language = getUiLanguage();
    const tr = (pt: string, en: string) => uiText(language, pt, en);
    const actor = await currentAdminV2(db);
    if (!actor) redirect("/control/login");
    if (actor.mustChangePassword) redirect("/control/password");
    const timeZone =
      (
        db
          .prepare(
            "SELECT time_zone zone FROM institution_timezones WHERE institution_id=?",
          )
          .get(id) as { zone: string } | undefined
      )?.zone ?? "America/Bahia";
    const institution = db
      .prepare(
        "SELECT id,name,archived_at archivedAt FROM institutions WHERE id=?",
      )
      .get(id) as
      { id: number; name: string; archivedAt: number | null } | undefined;
    if (!institution) notFound();
    const courses = db
      .prepare(
        "SELECT id,name,code,short_name shortName,archived_at archivedAt FROM programs WHERE institution_id=? ORDER BY name",
      )
      .all(id) as Array<{
      id: number;
      name: string;
      code: string;
      shortName: string | null;
      archivedAt: number | null;
    }>;
    const area = q.area ?? "overview";
    const base = `/control/institutions/${id}`;
    const returnTo = `${base}?area=${area}`;
    return (
      <ConsoleShell
        title={institution.name}
        kicker="ADMINISTRAÇÃO / INSTITUIÇÃO"
        name={actor.name}
        admin
        active="institutions"
        message={q.ok}
        error={q.error}
      >
        <nav
          className="admin-breadcrumb"
          aria-label={tr("Caminho", "Breadcrumb")}
        >
          <Link href="/control/institutions">
            <UiCopy pt="Instituições" en="Institutions" />
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{institution.name}</span>
        </nav>
        <div className="admin-context-summary admin-institution-summary">
          <strong>{institution.name}</strong>
          <span>
            {institution.archivedAt
              ? tr("Arquivada", "Archived")
              : tr("Ativa", "Active")}{" "}
            · {courses.filter((c) => !c.archivedAt).length}{" "}
            <UiCopy pt="cursos ativos" en="active courses" />
          </span>
        </div>
        <nav
          className="admin-context-nav"
          aria-label={tr("Áreas da instituição", "Institution sections")}
        >
          {[
            { key: "overview", label: "Visão geral" },
            { key: "courses", label: "Cursos" },
            { key: "settings", label: "Configuração" },
            { key: "subjects", label: "Disciplinas" },
            { key: "academic_periods", label: "Períodos" },
            { key: "shifts", label: "Turnos" },
            { key: "instructors", label: "Professores" },
            { key: "locations", label: "Salas" },
          ].map((item) => (
            <Link
              key={item.key}
              href={`${base}?area=${item.key}`}
              aria-current={area === item.key ? "page" : undefined}
            >
              {tr(
                item.label,
                {
                  courses: "Courses",
                  subjects: "Subjects",
                  academic_periods: "Periods",
                  shifts: "Shifts",
                  instructors: "Instructors",
                  locations: "Rooms",
                }[item.key] ?? item.label,
              )}
            </Link>
          ))}
        </nav>
        <div className="admin-context-links">
          <Link href={`${base}/events`}>
            {tr("Eventos e provas", "Events and exams")} →
          </Link>
          <Link href="/control/import">
            {tr("Importação acadêmica", "Academic import")} →
          </Link>
        </div>
        {area === "settings" ? (
          <section className="admin-setting-card">
            <h2>{tr("Configuração da instituição", "Institution settings")}</h2>
            <p>
              {tr(
                "Fuso horário e ciclo de vida do cadastro.",
                "Time zone and record lifecycle.",
              )}
            </p>{" "}
            <AdminActionPanel title="Fuso da instituição">
              <form action={controlAction} className="v2-fields">
                <HiddenContext
                  intent="institutionTimezone"
                  returnTo={`/control/institutions/${id}`}
                  institutionId={id}
                />
                <label>
                  Fuso horário
                  <input
                    name="timeZone"
                    required
                    defaultValue={timeZone}
                    placeholder="America/Bahia"
                  />
                </label>
                <p>
                  Horários das aulas e o dia da agenda usam este fuso, mesmo
                  quando o servidor está em UTC.
                </p>
                <button>Salvar fuso</button>
              </form>
            </AdminActionPanel>
            {RemovalPanel({
              db: db,
              actor: actor,
              entity: "institutions",
              id: id,
              returnTo: "/control/institutions",
              archived: !!institution.archivedAt,
            })}
          </section>
        ) : null}
        {area === "overview" ? (
          <section className="admin-portal-grid">
            {[
              {
                key: "courses",
                label: tr("Cursos", "Courses"),
                text: tr(
                  "Turmas, currículo, ofertas e matrículas",
                  "Cohorts, curriculum, offerings and enrollments",
                ),
                count: courses.filter((c) => !c.archivedAt).length,
              },
              ...collections.map((c) => ({
                key: c.entity,
                label: tr(c.title, collectionTitlesEn[c.entity]),
                text: tr("Cadastros da instituição", "Institution records"),
                count: (
                  db
                    .prepare(
                      `SELECT count(*) n FROM ${c.entity} WHERE institution_id=? AND archived_at IS NULL`,
                    )
                    .get(id) as { n: number }
                ).n,
              })),
            ].map((c) => (
              <Link
                className="admin-portal-card"
                key={c.key}
                href={`${base}?area=${c.key}`}
              >
                <small>
                  {c.count} {tr("ativos", "active")}
                </small>
                <h2>{c.label}</h2>
                <p>{c.text}</p>
                <span>{tr("Abrir área", "Open section")} →</span>
              </Link>
            ))}
          </section>
        ) : null}
        {area === "courses" ? (
          <section>
            <div className="admin-section-header">
              <h2>
                <UiCopy pt="Cursos" en="Courses" />
              </h2>
              <AdminActionPanel title="Adicionar curso">
                <form action={controlAction} className="v2-fields">
                  <HiddenContext
                    returnTo={returnTo}
                    intent="program"
                    institutionId={id}
                  />
                  <label>
                    <UiCopy pt="Nome do curso" en="Course name" />
                    <input name="name" required />
                  </label>
                  <label>
                    <UiCopy pt="Código institucional" en="Institutional code" />
                    <input name="code" required />
                    <small>
                      <UiCopy
                        pt="Identificador interno do curso."
                        en="Internal course identifier."
                      />
                    </small>
                  </label>
                  <label>
                    <UiCopy pt="Nome curto" en="Short name" />
                    <input name="shortName" required placeholder="ADS" />
                    <small>
                      <UiCopy
                        pt="Usado no nome da pasta de projetos."
                        en="Used in the project folder name."
                      />
                    </small>
                  </label>
                  <button>
                    <UiCopy pt="Criar curso" en="Create course" />
                  </button>
                </form>
              </AdminActionPanel>
            </div>
            <div className="admin-entity-list admin-catalog-list">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`${base}/courses/${course.id}`}
                  className="admin-entity-link"
                >
                  <strong>{course.name}</strong>
                  <span>{course.shortName || course.code}</span>
                  <span>
                    {course.archivedAt
                      ? tr("Arquivado", "Archived")
                      : tr("Ativo", "Active")}
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
            {!courses.length ? (
              <p>
                <UiCopy
                  pt="Nenhum curso nesta instituição."
                  en="No courses in this institution."
                />
              </p>
            ) : null}
          </section>
        ) : null}
        {collections
          .filter((collection) => collection.entity === area)
          .map((collection) => {
            const list = db
              .prepare(
                `SELECT *,${collection.entity === "academic_periods" ? "label" : "name"} display_name FROM ${collection.entity} WHERE institution_id=? ORDER BY id DESC`,
              )
              .all(id) as Array<
              Record<string, string | number | null> & {
                id: number;
                display_name: string;
                archived_at: number | null;
              }
            >;
            return (
              <section key={collection.entity}>
                <div className="admin-section-header">
                  <h2>
                    {tr(
                      collection.title,
                      collectionTitlesEn[collection.entity],
                    )}
                  </h2>
                  <AdminActionPanel
                    title={tr(
                      `Adicionar ${collection.title.toLowerCase()}`,
                      `Add ${collectionTitlesEn[collection.entity].toLowerCase()}`,
                    )}
                  >
                    <form action={controlAction} className="v2-fields">
                      <HiddenContext
                        returnTo={returnTo}
                        intent={collection.intent}
                        institutionId={id}
                      />
                      {collection.fields.map((field) => (
                        <label key={field}>
                          {tr(labels[field], labelsEn[field])}
                          <input
                            name={field}
                            type={field.endsWith("On") ? "date" : "text"}
                            required={
                              !optional.has(field) ||
                              (field === "code" &&
                                collection.entity === "shifts")
                            }
                          />
                        </label>
                      ))}
                      <button>
                        <UiCopy pt="Salvar" en="Save" />
                      </button>
                    </form>
                  </AdminActionPanel>
                </div>
                <div className="admin-entity-list admin-catalog-list">
                  {list.map((row) => (
                    <div className="admin-entity-row" key={row.id}>
                      <div>
                        <strong>{row.display_name}</strong>
                        <small>
                          {row.archived_at
                            ? tr("Arquivado", "Archived")
                            : tr("Ativo", "Active")}
                        </small>
                      </div>
                      <AdminActionPanel
                        title={tr(
                          `Editar ${row.display_name}`,
                          `Edit ${row.display_name}`,
                        )}
                      >
                        <form action={controlAction} className="v2-fields">
                          <HiddenContext
                            returnTo={returnTo}
                            intent="edit"
                            entity={collection.entity}
                            id={row.id}
                          />
                          {collection.fields.map((field) => (
                            <label key={field}>
                              {tr(labels[field], labelsEn[field])}
                              <input
                                name={field}
                                type={field.endsWith("On") ? "date" : "text"}
                                defaultValue={String(
                                  field === "startsOn"
                                    ? (row.starts_on ?? "")
                                    : field === "endsOn"
                                      ? (row.ends_on ?? "")
                                      : (row[field] ?? ""),
                                )}
                                required={
                                  !optional.has(field) ||
                                  (field === "code" &&
                                    collection.entity === "shifts")
                                }
                              />
                            </label>
                          ))}
                          <button>
                            <UiCopy pt="Salvar alterações" en="Save changes" />
                          </button>
                        </form>
                      </AdminActionPanel>
                      {RemovalPanel({
                        db: db,
                        actor: actor,
                        entity: collection.entity,
                        id: row.id,
                        returnTo: returnTo,
                        archived: !!row.archived_at,
                      })}
                    </div>
                  ))}
                </div>
                {!list.length ? (
                  <p>
                    <UiCopy pt="Nenhum cadastro ainda." en="No records yet." />
                  </p>
                ) : null}
              </section>
            );
          })}
      </ConsoleShell>
    );
  });
}
