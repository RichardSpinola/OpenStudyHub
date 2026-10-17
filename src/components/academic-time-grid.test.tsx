import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgendaSlot } from "@/lib/academic";
import { AcademicTimeGrid } from "./academic-time-grid";

const fixtureSlot: AgendaSlot = {
  offeringId: 1,
  subjectId: 2,
  subjectCode: "DEM-2",
  subjectName: "Prática Fictícia",
  subjectShortName: "Prática",
  programName: "Curso Demo",
  programShortName: null,
  periodLabel: "2026.2",
  instructorName: "Professor Fictício",
  classGroup: "A",
  curriculumTerm: "2º",
  status: "active",
  slotId: 7,
  weekday: 2,
  startsAtMinutes: 10 * 60,
  endsAtMinutes: 12 * 60,
  validFrom: null,
  validUntil: null,
  locationName: "Campus Demo",
  campus: null,
  building: null,
  room: "D-101",
};

describe("AcademicTimeGrid", () => {
  it("shows scheduled days and offers a full week, with accessible time, room and teacher", () => {
    const html = renderToStaticMarkup(
      <AcademicTimeGrid slots={[fixtureSlot]} today={2} />,
    );
    expect(html).toContain("Terça");
    expect(html).not.toContain("Segunda");
    expect(html).toContain("Semana completa");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("10:00");
    expect(html).toContain("12:00");
    expect(html).toContain("Campus Demo / D-101");
    expect(html).toContain("Professor Fictício");
    expect(html).toContain('aria-label="Prática Fictícia, 10:00–12:00');
  });

  it("shows a useful empty state", () => {
    const html = renderToStaticMarkup(
      <AcademicTimeGrid slots={[]} today={1} />,
    );
    expect(html).toContain("Nenhuma aula cadastrada nesta semana.");
  });

  it("extends the time axis for early and late classes", () => {
    const html = renderToStaticMarkup(
      <AcademicTimeGrid
        slots={[
          {
            ...fixtureSlot,
            slotId: 8,
            startsAtMinutes: 360,
            endsAtMinutes: 420,
          },
          {
            ...fixtureSlot,
            slotId: 9,
            startsAtMinutes: 22 * 60,
            endsAtMinutes: 23 * 60,
          },
        ]}
        today={2}
      />,
    );
    expect(html).toContain("06:00");
    expect(html).toContain("23:00");
    expect(html).toContain('class="weekly-compact-table"');
    expect(html.match(/scope="row"/g)).toHaveLength(2);
  });

  it("uses a compact interval around normal class times", () => {
    const html = renderToStaticMarkup(
      <AcademicTimeGrid slots={[fixtureSlot]} today={2} />,
    );
    expect(html).toContain("10:00");
    expect(html).toContain("12:00");
    expect(html.match(/scope="row"/g)).toHaveLength(1);
    expect(html).not.toContain("09:00");
    expect(html).not.toContain("13:00");
  });
});
