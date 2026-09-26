import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { SubjectCard } from "@/components/subject-card";
import { toggleSubjectHistoryAction } from "@/app/subjects/actions";
import { getAcademicPreferences } from "@/lib/academic-preferences";
import { partitionOfferingsByPeriod } from "@/lib/subject-periods";
import { withV2Db } from "@/lib/v2/runtime";
import { legacyOfferingIdsWithCover } from "@/lib/v2/offering-covers";

import {
  getCurrentAcademicPeriod,
  listUserSubjectOfferings,
  listUserSubjects,
  type SubjectOfferingSummary,
} from "@/lib/academic";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getTranslations, uiText } from "@/lib/translations";
import {
  defaultUiLanguage,
  getUiLanguage,
  type UiLanguage,
} from "@/lib/ui-language";

export const dynamic = "force-dynamic";

type SubjectsData =
  | {
      available: true;
      language: UiLanguage;
      subjects: ReturnType<typeof listUserSubjects>;
      offerings: SubjectOfferingSummary[];
      currentPeriod: ReturnType<typeof getCurrentAcademicPeriod>;
    }
  | { available: false; language: UiLanguage };

function loadSubjectsData(userId: number): SubjectsData {
  let language = defaultUiLanguage;

  try {
    language = getUiLanguage();
    return {
      available: true,
      language,
      subjects: listUserSubjects(userId),
      offerings: listUserSubjectOfferings(userId),
      currentPeriod: getCurrentAcademicPeriod(),
    };
  } catch {
    return { available: false, language };
  }
}

export default async function SubjectsPage() {
  const user = await requireAuthenticatedUser();
  const data = loadSubjectsData(user.id);
  const { academic } = getTranslations(data.language);
  const periods = data.available
    ? partitionOfferingsByPeriod(
        data.offerings,
        data.currentPeriod?.label ?? null,
      )
    : null;
  const showHistory = getAcademicPreferences(user.id).showSubjectHistory;
  const coveredOfferings =
    data.available && process.env.OPENSTUDYHUB_V2_ENABLED === "1"
      ? withV2Db((db) =>
          legacyOfferingIdsWithCover(
            db,
            data.offerings.map((offering) => offering.offeringId),
          ),
        )
      : new Set<number>();

  function cards(offerings: SubjectOfferingSummary[]) {
    return (
      <ol className="subject-list phase4-subject-list">
        {offerings.map((offering) => (
          <SubjectCard
            key={offering.offeringId}
            offering={offering}
            hasCover={coveredOfferings.has(offering.offeringId)}
            language={data.language}
          />
        ))}
      </ol>
    );
  }

  return (
    <div className="academic-shell">
      <header className="academic-heading">
        <div>
          <p className="system-label">{academic.subjectsSystem}</p>
          <h1>{academic.subjectsTitle}</h1>
          <p className="page-description">
            <UiCopy
              pt="Matérias, contexto atual e acesso rápido ao que vem a seguir."
              en="Subjects, current context and quick access to what comes next."
            />
          </p>
        </div>
        {data.available ? (
          <span className="count-label">
            {String(data.subjects.length).padStart(2, "0")}{" "}
            {academic.subjectCount}
          </span>
        ) : null}
      </header>

      {!data.available ? (
        <div className="useful-empty" role="alert">
          <strong>{academic.databaseUnavailable}</strong>
        </div>
      ) : data.subjects.length === 0 ? (
        <div className="useful-empty">
          <strong>{academic.noSubjects}</strong>
          <p>{academic.noSubjectsHint}</p>
          <Link href="/settings">
            <UiCopy
              pt="Revisar perfil e preferências"
              en="Review profile and preferences"
            />
          </Link>
        </div>
      ) : (
        <>
          <section className="subject-period-section">
            <div className="section-heading">
              <h2>
                <UiCopy pt="Semestre atual" en="Current semester" />
              </h2>
              <span>
                {data.currentPeriod?.label ??
                  uiText(
                    data.language,
                    "Aguardando período atual",
                    "Waiting for current period",
                  )}
              </span>
            </div>
            {periods?.current.length ? (
              cards(periods.current)
            ) : (
              <div className="useful-empty compact">
                <strong>
                  <UiCopy
                    pt="Nenhuma disciplina neste período"
                    en="No subjects in this period"
                  />
                </strong>
              </div>
            )}
          </section>
          <section className="subject-period-section">
            <div className="section-heading">
              <h2>
                <UiCopy pt="Semestres anteriores" en="Previous semesters" />
              </h2>
              <form action={toggleSubjectHistoryAction}>
                <button type="submit" aria-pressed={showHistory}>
                  {showHistory
                    ? uiText(
                        data.language,
                        "Recolher histórico",
                        "Hide history",
                      )
                    : uiText(
                        data.language,
                        "Mostrar histórico",
                        "Show history",
                      )}
                </button>
              </form>
            </div>
            {periods?.history.size && showHistory ? (
              [...periods.history].map(([period, group]) => (
                <details className="subject-history" key={period}>
                  <summary>
                    {period}
                    <span>
                      {group.length}
                      <UiCopy pt="disciplina(s)" en="subject(s)" />
                    </span>
                  </summary>
                  {cards(group)}
                </details>
              ))
            ) : !periods?.history.size ? (
              <p className="panel-help">
                <UiCopy
                  pt="Nenhum semestre anterior disponível."
                  en="No previous semesters available."
                />
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
