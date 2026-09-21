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
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.length > projectUploadLimits.maxPathLength
  ) {
    throw new Error("Invalid project path.");
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
    if (paths.has(path)) throw new Error("Project contains duplicate paths.");
    paths.add(path);
    const reason = projectIgnoreReason(path, preset);
    if (reason) {
      ignored.push({ path, reason });
      continue;
    }
    if (source.data.length > projectUploadLimits.maxFileBytes) {
      throw new Error("Project contains a file above the size limit.");
    }
    total += source.data.length;
    if (total > projectUploadLimits.maxTotalBytes) {
      throw new Error("Project exceeds the total size limit.");
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
