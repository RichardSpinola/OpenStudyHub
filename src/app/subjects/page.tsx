import Link from "next/link";

import {
  listUserSubjectOfferings,
  listUserSubjects,
  type SubjectOfferingSummary,
} from "@/lib/academic";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
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
    };
  } catch {
    return { available: false, language };
  }
}

export default async function SubjectsPage() {
  const user = await requireAuthenticatedUser();
  const data = loadSubjectsData(user.id);
  const { academic } = getTranslations(data.language);

  return (
    <div className="academic-shell">
      <header className="academic-heading">
        <div>
          <p className="system-label">{academic.subjectsSystem}</p>
          <h1>{academic.subjectsTitle}</h1>
          <p className="page-description">
            Matérias, contexto atual e acesso rápido ao que vem a seguir.
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
          <Link href="/settings">Revisar perfil e preferências</Link>
        </div>
      ) : (
        <ol className="subject-list">
          {data.subjects.map((subject, index) => {
            const offerings = data.offerings.filter(
              ({ subjectId }) => subjectId === subject.id,
            );

            return (
              <li className="subject-panel" key={subject.id}>
                <div className="subject-titlebar">
                  <span className="panel-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span>{subject.code ?? "—"}</span>
                    <h2>{subject.name}</h2>
                  </div>
                  <span className="count-label">
                    {String(offerings.length).padStart(2, "0")}{" "}
                    {academic.offeringCount}
                  </span>
                  <Link href={`/subjects/${subject.id}`}>Abrir matéria →</Link>
                </div>

                {offerings.length === 0 ? (
                  <div className="subject-no-offering">
                    {academic.noOfferings}
                  </div>
                ) : (
                  <div className="offering-list">
                    {offerings.map((offering) => (
                      <dl className="offering-row" key={offering.offeringId}>
                        <div>
                          <dt>{academic.program}</dt>
                          <dd>
                            {offering.programShortName ?? offering.programName}
                          </dd>
                        </div>
                        <div>
                          <dt>{academic.period}</dt>
                          <dd>{offering.periodLabel}</dd>
                        </div>
                        <div>
                          <dt>{academic.instructor}</dt>
                          <dd>{offering.instructorName ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>{academic.classGroup}</dt>
                          <dd>{offering.classGroup ?? "—"}</dd>
                        </div>
                      </dl>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
