import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { openV2Database, migrateV2, type V2Database } from "@/lib/v2/database";
import { seedV2Fake } from "@/lib/v2/fixtures";
import { adminActor } from "@/lib/v2/actor";

const state = vi.hoisted(() => ({ db: null as V2Database | null }));
vi.mock("@/lib/v2/runtime", () => ({
  currentAdminV2: async () => ({
    ...adminActor(1),
    name: "Admin QA",
    mustChangePassword: false,
  }),
  withV2DbAsync: async (fn: (db: V2Database) => Promise<unknown>) => {
    try {
      return await fn(state.db!);
    } finally {
      state.db!.close();
    }
  },
}));
vi.mock("@/lib/academic", () => ({ listSubjectOfferings: () => [] }));
vi.mock("@/lib/ui-language", () => ({ getUiLanguage: () => "pt-BR" }));
vi.mock("./actions", () => ({ controlAction: async () => {} }));
vi.mock("./ui", async () => ({
  ConsoleShell: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
  HiddenContext: (await import("./hidden-context")).HiddenContext,
}));
vi.mock("./admin-action-panel", () => ({
  AdminActionPanel: ({
    title,
    children,
  }: {
    title: string;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));
import Institution from "./institutions/[institutionId]/page";
import Course from "./institutions/[institutionId]/courses/[courseId]/page";
import Events from "./institutions/[institutionId]/events/page";

afterEach(() => {
  if (state.db?.open) state.db.close();
});
function fixture() {
  state.db = openV2Database(":memory:");
  migrateV2(state.db);
  seedV2Fake(state.db);
}
describe("Admin rendering after the request database is closed", () => {
  for (const area of ["settings", "locations"]) {
    it(`institution ${area} renders its removal details without a live connection`, async () => {
      fixture();
      const page = await Institution({
        params: Promise.resolve({ institutionId: "1" }),
        searchParams: Promise.resolve({ area }),
      });
      expect(state.db!.open).toBe(false);
      expect(renderToStaticMarkup(page)).toContain("Arquivar ou remover");
    });
  }
  for (const section of ["structure", "events"]) {
    it(`course ${section} renders without a live connection`, async () => {
      fixture();
      const page = await Course({
        params: Promise.resolve({ institutionId: "1", courseId: "1" }),
        searchParams: Promise.resolve({ section }),
      });
      expect(state.db!.open).toBe(false);
      expect(renderToStaticMarkup(page)).toContain(
        section === "events" ? "Adicionar evento" : "Arquivar ou remover",
      );
    });
  }
  it("institution events renders without a live connection", async () => {
    fixture();
    const page = await Events({
      params: Promise.resolve({ institutionId: "1" }),
      searchParams: Promise.resolve({}),
    });
    expect(state.db!.open).toBe(false);
    expect(renderToStaticMarkup(page)).toContain("Adicionar evento");
  });
});
