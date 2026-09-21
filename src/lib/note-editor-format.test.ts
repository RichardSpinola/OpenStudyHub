import { describe, expect, it } from "vitest";

import {
  applyNoteFormat,
  markdownToEditorHtml,
  type NoteFormat,
} from "./note-editor-format";

describe("note editor formatting", () => {
  it.each([
    ["heading", "## texto"],
    ["bold", "**texto**"],
    ["italic", "_texto_"],
    ["bullet", "- texto"],
    ["numbered", "1. texto"],
    ["checklist", "- [ ] texto"],
    ["quote", "> texto"],
    ["inline-code", "`texto`"],
    ["code-block", "```\ntexto\n```"],
    ["link", "[texto](https://)"],
  ] satisfies Array<[NoteFormat, string]>)(
    "aplica %s em Markdown portátil",
    (format, expected) => {
      expect(applyNoteFormat("texto", 0, 5, format).value).toBe(expected);
    },
  );

  it("numera múltiplas linhas selecionadas", () => {
    expect(applyNoteFormat("um\ndois", 0, 7, "numbered").value).toBe(
      "1. um\n2. dois",
    );
  });

  it("renderiza a escrita Markdown como conteúdo visual seguro", () => {
    const html = markdownToEditorHtml(
      "## Título\n**forte** e _ênfase_\n- item\n- [ ] tarefa\n> citação\n`inline`\n```\ncódigo\n```\n[site](https://example.test)",
    );
    expect(html).toContain("<h2>Título</h2>");
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain('class="task-list"');
    expect(html).toContain("<blockquote>citação</blockquote>");
    expect(html).toContain("<pre><code>código</code></pre>");
    expect(html).toContain('href="https://example.test/"');
  });

  it("não injeta HTML nem links com protocolo executável", () => {
    const html = markdownToEditorHtml(
      "<script>alert(1)</script> [x](javascript:alert(1))",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;script&gt;");
  });
});
