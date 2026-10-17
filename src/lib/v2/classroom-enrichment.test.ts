import { expect, it } from "vitest";
import { openV2Database, migrateV2 } from "./database";
import { GoogleClassroomAdapter } from "./classroom";
it("reads the official courseWorkMaterial response across pages and keeps published materials and their attachments", async () => {
  const db = openV2Database(":memory:");
  const pages: Array<string | null> = [];
  try {
    const adapter = new GoogleClassroomAdapter(
      db,
      async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/courseWorkMaterials")) {
          pages.push(url.searchParams.get("pageToken"));
          return Response.json(
            url.searchParams.has("pageToken")
              ? {
                  courseWorkMaterial: [
                    {
                      id: "reading-2",
                      title: "Vídeo da aula",
                      state: "PUBLISHED",
                      materials: [
                        {
                          youtubeVideo: {
                            title: "Aula",
                            alternateLink:
                              "https://www.youtube.com/watch?v=example",
                          },
                        },
                      ],
                    },
                  ],
                }
              : {
                  // The URL is plural; Google's response property is singular.
                  courseWorkMaterial: [
                    {
                      id: "reading-1",
                      title: "Material do professor",
                      description: "Leia antes da próxima aula",
                      state: "PUBLISHED",
                      alternateLink: "https://classroom.google.com/material",
                      materials: [
                        {
                          driveFile: {
                            driveFile: {
                              title: "Apostila.pdf",
                              alternateLink:
                                "https://drive.google.com/file/d/example/view",
                            },
                          },
                        },
                      ],
                    },
                    { id: "draft", title: "Rascunho privado", state: "DRAFT" },
                  ],
                  nextPageToken: "next-page",
                },
          );
        }
        if (url.pathname.endsWith("/courseWork"))
          return Response.json({
            courseWork: [
              { id: "task", title: "Atividade", state: "PUBLISHED" },
            ],
          });
        if (url.pathname.endsWith("/announcements"))
          return Response.json({
            announcements: [{ id: "notice", text: "Aviso" }],
          });
        return Response.json({ studentSubmissions: [] });
      },
      async () => "fake-access",
    );
    const feed = await adapter.listFeed(1, "test-course");
    expect(pages).toEqual([null, "next-page"]);
    expect(feed.map((item) => item.id)).toEqual([
      "0:task",
      "1:reading-1",
      "1:reading-2",
      "2:notice",
    ]);
    expect(feed[1]).toMatchObject({
      title: "Material do professor",
      description: "Leia antes da próxima aula",
      link: "https://classroom.google.com/material",
      materials: [
        {
          title: "Apostila.pdf",
          url: "https://drive.google.com/file/d/example/view",
        },
      ],
    });
    expect(feed[2].materials).toEqual([
      { title: "Aula", url: "https://www.youtube.com/watch?v=example" },
    ]);
  } finally {
    db.close();
  }
});
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
