import { describe, expect, it } from "vitest";

import { renderChatMarkdown } from "./chat-markdown";

describe("chat markdown", () => {
  it("renderiza riscado e código inline sem misturar os formatos", () => {
    const html = renderChatMarkdown("~~riscado~~ e `**codigo**` e **forte**");

    expect(html).toContain("<del>riscado</del>");
    expect(html).toContain("<code>**codigo**</code>");
    expect(html).toContain("<strong>forte</strong>");
    expect(html).not.toContain("<code><strong>");
  });

  it("escapa HTML dentro de código e texto comum", () => {
    const html = renderChatMarkdown("`<script>` <b>oi</b>");

    expect(html).toContain("<code>&lt;script&gt;</code>");
    expect(html).toContain("&lt;b&gt;oi&lt;/b&gt;");
    expect(html).not.toContain("<script>");
  });
});
