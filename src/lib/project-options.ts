import { z } from "zod";

export const projectUploadLimits = {
  maxFiles: 1_000,
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  // ZIP headers and incompressible-data overhead are separate from expanded data.
  maxArchiveBytes: 202 * 1024 * 1024,
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
