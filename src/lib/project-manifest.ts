import { createHash } from "node:crypto";
import { posix } from "node:path";

import { z } from "zod";

export const projectUploadLimits = {
  maxFiles: 1_000,
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxPathLength: 512,
  maxCompressionRatio: 100,
} as const;

export const projectLanguages = [
  "java",
  "javascript-typescript",
  "python",
  "c-cpp",
  "csharp",
  "php",
  "go",
  "rust",
  "other",
] as const;
export const projectLanguageSchema = z.enum(projectLanguages);
export type ProjectLanguage = z.infer<typeof projectLanguageSchema>;

export const projectLanguageLabels: Record<ProjectLanguage, string> = {
  java: "Java",
  "javascript-typescript": "JavaScript / TypeScript",
  python: "Python",
  "c-cpp": "C / C++",
  csharp: "C#",
  php: "PHP",
  go: "Go",
  rust: "Rust",
  other: "Outro",
};

export const projectTechnologies = [
  "html",
  "css",
  "javascript",
  "typescript",
  "react",
  "node",
  "java",
  "python",
  "c",
  "cpp",
  "csharp",
  "php",
  "go",
  "rust",
] as const;
export const projectTechnologySchema = z.enum(projectTechnologies);
export type ProjectTechnology = z.infer<typeof projectTechnologySchema>;
export const projectTechnologyLabels: Record<ProjectTechnology, string> = {
  html: "HTML",
  css: "CSS",
  javascript: "JavaScript",
  typescript: "TypeScript",
  react: "React",
  node: "Node.js",
  java: "Java",
  python: "Python",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  php: "PHP",
  go: "Go",
  rust: "Rust",
};

export type ProjectSourceFile = {
  path: string;
  data: Buffer;
  mimeType?: string | null;
};
export type ProjectManifestFile = {
  path: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string | null;
};
export type ProjectManifest = {
  schemaVersion: 1;
  files: ProjectManifestFile[];
};

const ignoredDirectoryNames = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".pytest_cache",
  ".mypy_cache",
  ".cache",
]);

export function normalizeProjectPath(input: string): string {
  if (input.includes("\0")) throw new Error("Path contains NUL.");
  const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized.split("/").includes("..")) {
    throw new Error(`Caminho bloqueado: ${input}`);
  }
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.length > projectUploadLimits.maxPathLength
  ) {
    throw new Error(
      `Caminho inválido ou acima de ${projectUploadLimits.maxPathLength} caracteres: ${input}`,
    );
  }
  const clean = posix.normalize(normalized);
  if (clean === ".." || clean.startsWith("../") || clean.includes("/../")) {
    throw new Error("Project path escapes its root.");
  }
  return clean;
}

export function projectIgnoreReason(
  rawPath: string,
  preset: ProjectLanguage,
): string | null {
  const path = normalizeProjectPath(rawPath);
  const segments = path.split("/");
  if (segments.some((segment) => ignoredDirectoryNames.has(segment))) {
    return "cache/build directory";
  }
  const basename = segments.at(-1)!.toLowerCase();
  if (
    (basename === ".env" || basename.startsWith(".env.")) &&
    basename !== ".env.example"
  ) {
    return "sensitive environment file";
  }
  if (
    basename.endsWith(".pem") ||
    basename.endsWith(".key") ||
    /^(credentials?|service-account|tokens?)(\.|-|_)/.test(basename) ||
    /^(credentials?|service-account|tokens?)\.json$/.test(basename)
  ) {
    return "sensitive credential file";
  }
  if (
    preset === "java" &&
    (basename.endsWith(".class") ||
      segments.includes("target") ||
      segments.includes(".gradle"))
  ) {
    return "language build artifact";
  }
  if (
    preset === "c-cpp" &&
    (basename.endsWith(".o") ||
      basename.endsWith(".obj") ||
      basename.endsWith(".exe"))
  ) {
    return "language build artifact";
  }
  return null;
}

export function buildProjectManifest(
  sources: ProjectSourceFile[],
  presetInput: ProjectLanguage,
): {
  manifest: ProjectManifest;
  accepted: Array<ProjectSourceFile & { path: string }>;
  ignored: Array<{ path: string; reason: string }>;
} {
  const preset = projectLanguageSchema.parse(presetInput);
  if (sources.length > projectUploadLimits.maxFiles) {
    throw new Error("Project exceeds the file count limit.");
  }
  const accepted: Array<ProjectSourceFile & { path: string }> = [];
  const ignored: Array<{ path: string; reason: string }> = [];
  const paths = new Set<string>();
  let total = 0;
  for (const source of sources) {
    const path = normalizeProjectPath(source.path);
    if (paths.has(path)) throw new Error(`Caminho duplicado: ${path}`);
    paths.add(path);
    const reason = projectIgnoreReason(path, preset);
    if (reason) {
      ignored.push({ path, reason });
      continue;
    }
    if (source.data.length > projectUploadLimits.maxFileBytes) {
      throw new Error(
        `Arquivo acima de ${projectUploadLimits.maxFileBytes / 1048576} MiB: ${path}`,
      );
    }
    total += source.data.length;
    if (total > projectUploadLimits.maxTotalBytes) {
      throw new Error(
        `Projeto acima do limite total de ${projectUploadLimits.maxTotalBytes / 1048576} MiB.`,
      );
    }
    accepted.push({ ...source, path });
  }
  if (accepted.length === 0) throw new Error("Project has no accepted files.");
  accepted.sort((a, b) => a.path.localeCompare(b.path));
  return {
    accepted,
    ignored,
    manifest: {
      schemaVersion: 1,
      files: accepted.map((file) => ({
        path: file.path,
        sha256: createHash("sha256").update(file.data).digest("hex"),
        sizeBytes: file.data.length,
        mimeType: file.mimeType || null,
      })),
    },
  };
}

export function diffProjectManifests(
  previous: ProjectManifest | null,
  current: ProjectManifest,
) {
  const before = new Map(
    previous?.files.map((file) => [file.path, file]) ?? [],
  );
  const after = new Map(current.files.map((file) => [file.path, file]));
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];
  for (const file of current.files) {
    const old = before.get(file.path);
    if (!old) added.push(file.path);
    else if (old.sha256 !== file.sha256) modified.push(file.path);
    else unchanged.push(file.path);
  }
  for (const file of previous?.files ?? []) {
    if (!after.has(file.path)) removed.push(file.path);
  }
  return { added, modified, removed, unchanged };
}

export function suggestProjectLanguage(
  files: ProjectManifestFile[],
): ProjectLanguage {
  const paths = files.map(({ path }) => path.toLowerCase());
  const markers: Array<[RegExp, ProjectLanguage]> = [
    [/(^|\/)(pom\.xml|build\.gradle|build\.gradle\.kts)$/u, "java"],
    [/(^|\/)(package\.json|tsconfig\.json)$/u, "javascript-typescript"],
    [/(^|\/)(pyproject\.toml|requirements\.txt)$/u, "python"],
    [/(^|\/)cargo\.toml$/u, "rust"],
    [/(^|\/)go\.mod$/u, "go"],
    [/\.csproj$/u, "csharp"],
    [/(^|\/)composer\.json$/u, "php"],
  ];
  for (const [marker, language] of markers) {
    if (paths.some((path) => marker.test(path))) return language;
  }
  const extensions: Array<[RegExp, ProjectLanguage]> = [
    [/\.(tsx?|jsx?)$/u, "javascript-typescript"],
    [/\.java$/u, "java"],
    [/\.py$/u, "python"],
    [/\.(c|cpp|cc|h|hpp)$/u, "c-cpp"],
    [/\.cs$/u, "csharp"],
    [/\.php$/u, "php"],
    [/\.go$/u, "go"],
    [/\.rs$/u, "rust"],
  ];
  const counts = extensions
    .map(([pattern, language]) => ({
      language,
      count: paths.filter((path) => pattern.test(path)).length,
    }))
    .sort((a, b) => b.count - a.count);
  return counts[0]?.count ? counts[0].language : "other";
}

export function suggestProjectTechnologies(
  files: ProjectManifestFile[],
): ProjectTechnology[] {
  const paths = files.map(({ path }) => path.toLowerCase());
  const has = (pattern: RegExp) => paths.some((path) => pattern.test(path));
  const found: ProjectTechnology[] = [];
  const add = (technology: ProjectTechnology, pattern: RegExp) => {
    if (has(pattern)) found.push(technology);
  };
  add("html", /\.html?$/u);
  add("css", /\.css$/u);
  add("typescript", /\.(ts|tsx)$/u);
  add("javascript", /\.(js|jsx|mjs|cjs)$/u);
  add("react", /\.(tsx|jsx)$/u);
  add("node", /(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock)$/u);
  add("java", /\.java$/u);
  add("python", /\.py$/u);
  add("c", /\.c$/u);
  add("cpp", /\.(cpp|cc|cxx)$/u);
  add("csharp", /\.cs$/u);
  add("php", /\.php$/u);
  add("go", /\.go$/u);
  add("rust", /\.rs$/u);
  return found;
}
