const previewExtensions =
  /\.(java|js|mjs|cjs|ts|tsx|jsx|py|c|h|cpp|cc|hpp|cs|php|go|rs|html|css|json|xml|ya?ml|sql|md|txt|sh|toml|ini|conf|config|properties|gradle|gitignore|dockerignore|env\.example)$/iu;
const previewNames = new Set([
  "dockerfile",
  "makefile",
  "readme",
  "license",
  "package.json",
  ".gitignore",
  ".dockerignore",
  ".env.example",
]);
export const maxProjectPreviewBytes = 256 * 1024;

export function canPreviewProjectPath(path: string): boolean {
  const name = path.split("/").at(-1)?.toLowerCase() ?? "";
  return previewNames.has(name) || previewExtensions.test(name);
}

export function decodeProjectText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  let value: string;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const suspicious = [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  });
  return suspicious ? null : value;
}

export type ProjectBrowserFile = {
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  driveFileId: string;
};

export type ProjectTreeNode = {
  name: string;
  path: string;
  children: ProjectTreeNode[];
  file: ProjectBrowserFile | null;
};

export function buildProjectFileTree(
  files: ProjectBrowserFile[],
): ProjectTreeNode[] {
  const roots: ProjectTreeNode[] = [];
  for (const file of files) {
    let nodes = roots;
    let path = "";
    const segments = file.path.split("/");
    for (const [index, name] of segments.entries()) {
      path = path ? `${path}/${name}` : name;
      let node = nodes.find((item) => item.name === name);
      if (!node) {
        node = { name, path, children: [], file: null };
        nodes.push(node);
      }
      if (index === segments.length - 1) node.file = file;
      nodes = node.children;
    }
  }
  const sort = (nodes: ProjectTreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name),
    );
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}
