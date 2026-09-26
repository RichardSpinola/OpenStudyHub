import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import type { SubjectOfferingSummary } from "@/lib/academic";
import type { UiLanguage } from "@/lib/ui-language";

export function SubjectCard({
  offering,
  hasCover = false,
  language = "pt-BR",
}: {
  offering: SubjectOfferingSummary;
  hasCover?: boolean;
  language?: UiLanguage;
}) {
  const seed = `${offering.subjectCode ?? ""}:${offering.subjectName}`;
  const pattern = [...seed].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 4,
    0,
  );
  return (
    <li className="subject-panel">
      <Link
        className="subject-card-link"
        href={`/subjects/${offering.subjectId}`}
        aria-label={`${language === "en" ? "Open subject" : "Abrir disciplina"} ${offering.subjectName}, ${offering.periodLabel}`}
      >
        <span
          className="subject-card-cover"
          data-pattern={pattern}
          data-cover={hasCover ? "true" : undefined}
          style={
            hasCover
              ? {
                  backgroundImage: `linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,.08)), url('/api/subject-cover/${offering.offeringId}')`,
                }
              : undefined
          }
          aria-hidden="true"
        >
          <span>
            {(offering.subjectCode ?? offering.subjectName).slice(0, 12)}
          </span>
        </span>
        <span className="page-kicker">
          {offering.subjectCode ??
            (language === "en" ? "SUBJECT" : "DISCIPLINA")}{" "}
          / {offering.periodLabel}
        </span>
        <strong>{offering.subjectName}</strong>
        <span className="subject-card-meta">
          {offering.programShortName ?? offering.programName}
          {offering.classGroup
            ? ` · ${language === "en" ? "Cohort" : "Turma"} ${offering.classGroup}`
            : ""}
        </span>
        <span className="subject-card-meta">
          {offering.instructorName ??
            (language === "en"
              ? "Instructor unavailable"
              : "Professor não informado")}
        </span>
        <span className="subject-card-open">
          <UiCopy pt="Abrir disciplina →" en="Open subject →" />
        </span>
      </Link>
    </li>
  );
}
