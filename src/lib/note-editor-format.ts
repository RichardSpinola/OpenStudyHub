export type NoteFormat =
  | "heading"
  | "bold"
  | "italic"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "inline-code"
  | "code-block"
  | "link";

export type FormattedSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeHref(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? escapeHtml(url.toString())
      : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(value: string): string {
  let output = escapeHtml(value);
  output = output.replaceAll(
    /\[([^\]]+)\]\(([^)]+)\)/gu,
    (match, label: string, href: string) => {
      const safe = safeHref(href);
      return safe
        ? `<a href="${safe}" target="_blank" rel="noreferrer">${label}</a>`
        : match;
    },
  );
  output = output.replaceAll(/`([^`]+)`/gu, "<code>$1</code>");
  output = output.replaceAll(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>");
  output = output.replaceAll(/_([^_]+)_/gu, "<em>$1</em>");
  return output;
}

export function markdownToEditorHtml(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    } else if (/^#{1,6}\s/u.test(line)) {
      const marker = line.match(/^#{1,6}/u)?.[0] ?? "##";
      output.push(
        `<h${marker.length}>${inlineMarkdown(line.slice(marker.length).trim())}</h${marker.length}>`,
      );
    } else if (/^- \[[ xX]\]\s/u.test(line)) {
      const checked = /^- \[[xX]\]/u.test(line);
      output.push(
        `<ul class="task-list"><li data-task="${checked ? "done" : "open"}"><span contenteditable="false">${checked ? "☑" : "☐"}</span> ${inlineMarkdown(line.replace(/^- \[[ xX]\]\s/u, ""))}</li></ul>`,
      );
    } else if (/^-\s/u.test(line)) {
      output.push(`<ul><li>${inlineMarkdown(line.slice(2))}</li></ul>`);
    } else if (/^\d+\.\s/u.test(line)) {
      output.push(
        `<ol><li>${inlineMarkdown(line.replace(/^\d+\.\s/u, ""))}</li></ol>`,
      );
    } else if (/^>\s?/u.test(line)) {
      output.push(
        `<blockquote>${inlineMarkdown(line.replace(/^>\s?/u, ""))}</blockquote>`,
      );
    } else if (!line.trim()) {
      output.push("<p><br></p>");
    } else {
      output.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }
  return output.join("");
}

function wrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after = before,
  fallback = "texto",
): FormattedSelection {
  const selected = value.slice(start, end) || fallback;
  const replacement = `${before}${selected}${after}`;
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + selected.length,
  };
}

function prefixLines(
  value: string,
  start: number,
  end: number,
  prefix: (index: number) => string,
): FormattedSelection {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const selected = value.slice(lineStart, lineEnd) || "item";
  const replacement = selected
    .split("\n")
    .map((line, index) => `${prefix(index)}${line}`)
    .join("\n");
  return {
    value: `${value.slice(0, lineStart)}${replacement}${value.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + replacement.length,
  };
}

export function applyNoteFormat(
  value: string,
  start: number,
  end: number,
  format: NoteFormat,
): FormattedSelection {
  switch (format) {
    case "heading":
      return prefixLines(value, start, end, () => "## ");
    case "bullet":
      return prefixLines(value, start, end, () => "- ");
    case "numbered":
      return prefixLines(value, start, end, (index) => `${index + 1}. `);
    case "checklist":
      return prefixLines(value, start, end, () => "- [ ] ");
    case "quote":
      return prefixLines(value, start, end, () => "> ");
    case "bold":
      return wrap(value, start, end, "**");
    case "italic":
      return wrap(value, start, end, "_");
    case "inline-code":
      return wrap(value, start, end, "`");
    case "code-block":
      return wrap(value, start, end, "```\n", "\n```", "código");
    case "link":
      return wrap(value, start, end, "[", "](https://)", "link");
  }
}
