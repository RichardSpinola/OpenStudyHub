import { expect, it } from "vitest";
import { openV2Database, migrateV2 } from "./database";
import { GoogleClassroomAdapter } from "./classroom";
it("retains description, materials, UTC deadline and own submission, excluding drafts", async () => {
  const db = openV2Database(":memory:");
  try {
    migrateV2(db);
    const paths: string[] = [];
    const adapter = new GoogleClassroomAdapter(
      db,
      async (url) => {
        const path = new URL(String(url));
        paths.push(path.pathname + path.search);
        let body: unknown = {};
        if (path.pathname.endsWith("/courseWork"))
          body = {
            courseWork: [
              {
                id: "task",
                title: "Task",
                description: "Full description",
                state: "PUBLISHED",
                dueDate: { year: 2026, month: 10, day: 20 },
                dueTime: { hours: 15, minutes: 30 },
                materials: [
                  {
                    link: {
                      title: "Instructions",
                      url: "https://example.test/file",
                    },
                  },
                  { link: { url: "javascript:bad" } },
                ],
              },
              { id: "draft", state: "DRAFT" },
            ],
          };
        if (path.pathname.endsWith("/studentSubmissions"))
          body = {
            studentSubmissions: [{ courseWorkId: "task", state: "TURNED_IN" }],
          };
        return new Response(JSON.stringify(body), { status: 200 });
      },
      async () => "fake-access",
    );
    const feed = await adapter.listFeed(1, "demo");
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({
      id: "0:task",
      description: "Full description",
      dueAt: Date.UTC(2026, 9, 20, 15, 30),
      submissionState: "TURNED_IN",
      materials: [{ title: "Instructions", url: "https://example.test/file" }],
    });
    expect(paths.some((p) => p.includes("userId=me"))).toBe(true);
  } finally {
    db.close();
  }
});
