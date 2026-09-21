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

export function renderChatMarkdown(source: string): string {
  const value = source.trim().slice(0, 10_000);
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
  const closeList = () => {
    if (listKind) rendered.push(`</${listKind}>`);
    listKind = null;
  };
  for (const line of lines) {
    const unordered = /^[-*] (.+)$/u.exec(line);
    const ordered = /^\d+[.] (.+)$/u.exec(line);
    if (unordered || ordered) {
      const kind = unordered ? "ul" : "ol";
      if (listKind !== kind) {
        closeList();
        listKind = kind;
        rendered.push(`<${kind}>`);
      }
      rendered.push(`<li>${inline((unordered ?? ordered)![1])}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) continue;
    if (line.startsWith("> ")) {
      rendered.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    } else {
      rendered.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return rendered
    .join("")
    .replaceAll(
      /@@CODE_(\d+)@@/gu,
      (_, index: string) => blocks[Number(index)] ?? "",
    );
}
