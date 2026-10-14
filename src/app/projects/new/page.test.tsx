import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/authorization", () => ({
  requireAuthenticatedUser: () => ({ id: 7 }),
}));
vi.mock("@/lib/profile", () => ({
  getUserProfile: () => ({ locale: "pt-BR" }),
}));
vi.mock("@/lib/academic", () => ({
  listUserSubjectOfferings: () => [
    {
      offeringId: 1,
      subjectId: 1,
      subjectName: "Fictícia",
      periodLabel: "2026.2",
    },
  ],
}));
vi.mock("@/app/projects/actions", () => ({ createProjectAction: vi.fn() }));
import NewProjectPage from "@/components/project-create-workspace";
describe("library project entry modes", () => {
  it("starts empty through the existing action without routing to file selection", async () => {
    const html = renderToStaticMarkup(
      await NewProjectPage({
        searchParams: Promise.resolve({ from: "projects", mode: "empty" }),
      }),
    );
    expect(html).toContain('name="start" value="empty"');
    expect(html).toContain("Criar projeto vazio");
    expect(html).not.toContain("Criar e importar");
    expect(html).toContain("/library?type=projects");
  });
  it("offers import as a separate guided entry", async () => {
    const html = renderToStaticMarkup(
      await NewProjectPage({
        searchParams: Promise.resolve({ from: "projects", mode: "import" }),
      }),
    );
    expect(html).toContain("Importar projeto");
    expect(html).toContain("Criar e importar");
    expect(html).not.toContain('name="start" value="empty"');
  });
  it("preserves both choices on older entry URLs", async () => {
    const html = renderToStaticMarkup(
      await NewProjectPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Começar vazio");
    expect(html).toContain("Criar e importar");
  });
});
