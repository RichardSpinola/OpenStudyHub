import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubjectCard } from "./subject-card";

describe("SubjectCard", () => {
  it("makes the complete offering card a named keyboard-accessible link", () => {
    const html = renderToStaticMarkup(
      <SubjectCard
        offering={{
          offeringId: 4,
          subjectId: 2,
          subjectCode: "DEM-2",
          subjectName: "Prática Fictícia",
          subjectShortName: null,
          programName: "Curso Demo",
          programShortName: null,
          periodLabel: "2026.2",
          instructorName: "Professor Fictício",
          classGroup: "A",
          curriculumTerm: "2º",
          status: "active",
        }}
      />,
    );
    expect(html).toContain('href="/subjects/2"');
    expect(html).toContain(
      'aria-label="Abrir disciplina Prática Fictícia, 2026.2"',
    );
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("Turma A");
  });
});
