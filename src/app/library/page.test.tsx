import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  enabled: vi.fn(),
  documents: vi.fn(),
  own: vi.fn(),
  shared: vi.fn(),
  projects: vi.fn(),
}));
vi.mock("@/lib/authorization", () => ({
  requireAuthenticatedUser: mocks.auth,
}));
vi.mock("@/lib/feature-flags", () => ({
  isProjectsFeatureEnabled: mocks.enabled,
}));
vi.mock("@/lib/profile", () => ({
  getUserProfile: () => ({ locale: "pt-BR" }),
}));
vi.mock("@/lib/document-workflows", () => ({
  listUserGeneratedDocuments: mocks.own,
  listSharedGeneratedDocuments: mocks.shared,
}));
vi.mock("@/lib/v2/local-documents", () => ({
  listLocalDocuments: () => [],
  listSharedLocalDocuments: () => [],
}));
vi.mock("@/lib/collaboration", () => ({
  listUserStudyGroups: () => [],
  listVisibleUsers: () => [],
}));
vi.mock("@/lib/projects", () => ({ listUserProjects: mocks.projects }));
vi.mock("../documents/page", () => ({ default: mocks.documents }));
vi.mock("@/components/document-library-card", () => ({
  DocumentLibraryCard: ({ document }: { document: { name: string } }) => (
    <li>{document.name}</li>
  ),
}));
vi.mock("@/components/local-document-card", () => ({
  LocalDocumentCard: () => null,
}));
vi.mock("@/components/project-library-card", () => ({
  ProjectLibraryCard: () => null,
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));
import LibraryPage from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: 7 });
  mocks.enabled.mockReturnValue(true);
  mocks.documents.mockResolvedValue("docs");
  mocks.own.mockReturnValue([
    {
      id: 1,
      name: "Meu documento",
      offeringId: 1,
      subjectName: "Fictícia",
      updatedAt: 1,
    },
  ]);
  mocks.shared.mockReturnValue([
    {
      id: 2,
      name: "Compartilhado",
      offeringId: 2,
      subjectName: "Outra",
      updatedAt: 2,
    },
  ]);
  mocks.projects.mockReturnValue([]);
});
describe("organized library access", () => {
  it("uses only owner and shared loaders for the authenticated user and applies filters", async () => {
    const html = renderToStaticMarkup(
      await LibraryPage({
        searchParams: Promise.resolve({
          scope: "shared",
          q: "compart",
          layout: "list",
        }),
      }),
    );
    expect(mocks.own).toHaveBeenCalledWith(7);
    expect(mocks.shared).toHaveBeenCalledWith(7);
    expect(html).toContain("Compartilhado");
    expect(html).not.toContain("Meu documento");
    expect(html).toContain("is-list");
    expect(html).toContain("Filtrar pelo nome");
    expect(html).toContain("Modelos de documento");
  });
  it("preserves template creation workflow parameters", async () => {
    expect(
      await LibraryPage({
        searchParams: Promise.resolve({ view: "templates", templateId: "3" }),
      }),
    ).toBe("docs");
    expect(await mocks.documents.mock.calls[0][0].searchParams).toEqual({
      view: "templates",
      templateId: "3",
    });
  });
  it("blocks disabled projects before loading data", async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(
      LibraryPage({ searchParams: Promise.resolve({ type: "projects" }) }),
    ).rejects.toThrow("redirect:/library");
    expect(mocks.projects).not.toHaveBeenCalled();
  });
  it("does not read private data without a normal session", async () => {
    mocks.auth.mockRejectedValue(new Error("unauthorized"));
    await expect(
      LibraryPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("unauthorized");
    expect(mocks.own).not.toHaveBeenCalled();
    expect(mocks.shared).not.toHaveBeenCalled();
    expect(mocks.projects).not.toHaveBeenCalled();
  });
});
