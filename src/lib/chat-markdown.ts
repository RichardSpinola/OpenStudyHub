const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function inline(source: string): string {
  const codeSpans: string[] = [];
  const escaped = escapeHtml(source).replaceAll(
    /`([^`\n]+)`/gu,
    (_, code: string) => {
      const marker = `@@INLINE_CODE_${codeSpans.length}@@`;
      codeSpans.push(`<code>${code}</code>`);
      return marker;
    },
  );
  return escaped
    .replaceAll(/\*\*([^*\n]+)\*\*/gu, "<strong>$1</strong>")
    .replaceAll(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, "<em>$1</em>")
    .replaceAll(/~~([^~\n]+)~~/gu, "<del>$1</del>")
    .replaceAll(
      /@\[([^\n\]]+)\]\(user:(\d+)\)/gu,
      '<span class="chat-mention" data-user-id="$2">@$1</span>',
    )
    .replaceAll(
      /\[([^\n\]]+)\]\((https?:\/\/[^\s)]+)\)/gu,
      '<a href="$2" rel="nofollow noopener noreferrer" target="_blank">$1</a>',
    )
    .replaceAll(
      /@@INLINE_CODE_(\d+)@@/gu,
      (_, index: string) => codeSpans[Number(index)] ?? "",
    );
}

export function renderChatMarkdown(source: string, limit = 10_000): string {
  const value = source.trim().slice(0, limit);
  const blocks: string[] = [];
  const withoutCodeBlocks = value.replaceAll(
    /```(?:[^\n]*)\n([\s\S]*?)```/gu,
    (_, code: string) => {
      const marker = `@@CODE_${blocks.length}@@`;
      blocks.push(`<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`);
      return marker;
    },
  );
  const lines = withoutCodeBlocks.split("\n");
  const rendered: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  let quoting = false;
  const closeQuote = () => {
    if (quoting) rendered.push("</blockquote>");
    quoting = false;
  };
  const closeList = () => {
    if (listKind) rendered.push(`</${listKind}>`);
    listKind = null;
  };
  for (const line of lines) {
    // Blank lines between items ("1. a\n\n2. b") keep the list open.
    if (!line.trim() && listKind) continue;
    if (line.startsWith("> ")) {
      closeList();
      if (!quoting) rendered.push("<blockquote>");
      quoting = true;
      rendered.push(`<p>${inline(line.slice(2))}</p>`);
      continue;
    }
    closeQuote();
    // Models often emit "*   item" and "### Heading"; accept the common spacing.
    const unordered = /^[-*]\s+(.+)$/u.exec(line);
    const ordered = /^(\d+)[.]\s+(.+)$/u.exec(line);
    const heading = /^#{1,4}\s+(.+)$/u.exec(line);
    if (heading) {
      closeList();
      rendered.push(`<p><strong>${inline(heading[1])}</strong></p>`);
      continue;
    }
    if (unordered || ordered) {
      const kind = unordered ? "ul" : "ol";
      if (listKind !== kind) {
        closeList();
        listKind = kind;
        const start = ordered ? Number(ordered[1]) : 1;
        rendered.push(
          start > 1 && start < 10000 ? `<ol start="${start}">` : `<${kind}>`,
        );
      }
      rendered.push(
        `<li>${inline(unordered ? unordered[1] : ordered![2])}</li>`,
      );
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    rendered.push(`<p>${inline(line)}</p>`);
  }
  closeQuote();
  closeList();
  return rendered
    .join("")
    .replaceAll(
      /@@CODE_(\d+)@@/gu,
      (_, index: string) => blocks[Number(index)] ?? "",
    );
}
