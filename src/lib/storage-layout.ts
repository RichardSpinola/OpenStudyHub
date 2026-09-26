import { z } from "zod";

import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const segmentPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !/[\\/\0]/.test(value) && !value.includes(".."), {
    message: "Padrão de pasta inválido.",
  });

export const storageCategorySchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,39}$/),
  label: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((value) => !/[\\/\0]/.test(value) && !value.includes("..")),
  kind: z.enum(["activity", "notes", "documents", "projects", "custom"]),
  enabled: z.boolean(),
});

export const storageLayoutSchema = z.object({
  includeCohort: z.boolean(),
  patterns: z.object({
    program: segmentPatternSchema,
    cohort: segmentPatternSchema,
    period: segmentPatternSchema,
    subject: segmentPatternSchema,
  }),
  categories: z.array(storageCategorySchema).min(1).max(20),
});

export type StorageLayout = z.infer<typeof storageLayoutSchema>;
export type StorageLayoutContext = {
  program: { name: string; shortName: string | null };
  cohort: { name: string } | null;
  period: { label: string };
  subject: { name: string; shortName: string | null };
};

export const defaultStorageLayout: StorageLayout = {
  includeCohort: true,
  patterns: {
    program: "{{program.short_name}}",
    cohort: "{{cohort.name}}",
    period: "{{period.label}}",
    subject: "{{subject.name}}",
  },
  categories: [
    { key: "activities", label: "Atividades", kind: "activity", enabled: true },
    { key: "notes", label: "Anotações", kind: "notes", enabled: true },
    { key: "documents", label: "Documentos", kind: "documents", enabled: true },
    { key: "projects", label: "Projetos", kind: "projects", enabled: true },
  ],
};

function cleanSegment(value: string): string {
  const cleaned = value.trim().replace(/[\u0000-\u001f<>:"/\\|?*]/g, "-");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Segmento de pasta inválido.");
  }
  return cleaned.slice(0, 120);
}

function renderPattern(pattern: string, values: Record<string, string | null>) {
  const rendered = pattern.replace(/{{\s*([^}]+)\s*}}/g, (_, key: string) => {
    const value = values[key.trim()];
    return value?.trim() || "Sem nome";
  });
  return cleanSegment(rendered);
}

export function getStorageLayout(
  connection: DatabaseConnection = getDatabase(),
): StorageLayout {
  const row = connection.sqlite
    .prepare(
      `select include_cohort as includeCohort, patterns_json as patternsJson,
              categories_json as categoriesJson
       from storage_settings where id = 1`,
    )
    .get() as
    | { includeCohort: number; patternsJson: string; categoriesJson: string }
    | undefined;
  if (!row) return defaultStorageLayout;
  const stored = storageLayoutSchema.parse({
    includeCohort: row.includeCohort === 1,
    patterns: JSON.parse(row.patternsJson),
    categories: JSON.parse(row.categoriesJson),
  });
  const knownKeys = new Set(stored.categories.map(({ key }) => key));
  return storageLayoutSchema.parse({
    ...stored,
    categories: [
      ...stored.categories,
      ...defaultStorageLayout.categories.filter(
        ({ key }) => !knownKeys.has(key),
      ),
    ],
  });
}

export function updateStorageLayout(
  actorUserId: number,
  input: StorageLayout,
  connection: DatabaseConnection = getDatabase(),
): void {
  const value = storageLayoutSchema.parse(input);
  const actor = connection.sqlite
    .prepare("select role from users where id = ? and active = 1")
    .get(z.number().int().positive().parse(actorUserId)) as
    { role: string } | undefined;
  if (actor?.role !== "admin") throw new Error("Admin access required.");
  connection.sqlite
    .prepare(
      `insert into storage_settings
       (id, include_cohort, patterns_json, categories_json,
        updated_by_user_id, updated_at)
       values (1, ?, ?, ?, ?, ?)
       on conflict(id) do update set
         include_cohort = excluded.include_cohort,
         patterns_json = excluded.patterns_json,
         categories_json = excluded.categories_json,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = excluded.updated_at`,
    )
    .run(
      Number(value.includeCohort),
      JSON.stringify(value.patterns),
      JSON.stringify(value.categories),
      actorUserId,
      Date.now(),
    );
}

export function buildOfferingStoragePath(
  layoutInput: StorageLayout,
  context: StorageLayoutContext,
): string[] {
  const layout = storageLayoutSchema.parse(layoutInput);
  const values = {
    "program.name": context.program.name,
    "program.short_name": context.program.shortName ?? context.program.name,
    "cohort.name": context.cohort?.name ?? null,
    "period.label": context.period.label,
    "subject.name": context.subject.name,
    "subject.short_name": context.subject.shortName ?? context.subject.name,
  };
  return [
    renderPattern(layout.patterns.program, values),
    ...(layout.includeCohort && context.cohort
      ? [renderPattern(layout.patterns.cohort, values)]
      : []),
    renderPattern(layout.patterns.period, values),
    renderPattern(layout.patterns.subject, values),
  ];
}

export function buildStoragePath(
  layoutInput: StorageLayout,
  context: StorageLayoutContext,
  categoryKind: StorageLayout["categories"][number]["kind"],
): string[] {
  const layout = storageLayoutSchema.parse(layoutInput);
  const category = layout.categories.find(
    (item) => item.kind === categoryKind && item.enabled,
  );
  if (!category) throw new Error("Categoria de armazenamento desativada.");
  return [
    ...buildOfferingStoragePath(layout, context),
    cleanSegment(category.label),
  ];
}

export function buildProjectStoragePath(
  context: StorageLayoutContext,
): string[] {
  return [
    cleanSegment(
      `Projetos - ${context.program.shortName?.trim() || context.program.name}`,
    ),
    cleanSegment(context.period.label),
    cleanSegment(context.subject.name),
  ];
}

export function getOfferingStorageContext(
  userId: number,
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): StorageLayoutContext {
  const row = connection.sqlite
    .prepare(
      `select p.name as programName, p.short_name as programShortName,
              c.name as cohortName, ap.label as periodLabel,
              s.name as subjectName, s.short_name as subjectShortName
       from subject_offerings so
       join enrollments e on e.offering_id = so.id and e.user_id = ?
       join programs p on p.id = so.program_id
       join academic_periods ap on ap.id = so.academic_period_id
       join subjects s on s.id = so.subject_id
       left join user_academic_memberships uam on uam.user_id = e.user_id
       left join cohorts c on c.id = uam.cohort_id and c.program_id = so.program_id
       where so.id = ?`,
    )
    .get(userId, offeringId) as
    | {
        programName: string;
        programShortName: string | null;
        cohortName: string | null;
        periodLabel: string;
        subjectName: string;
        subjectShortName: string | null;
      }
    | undefined;
  if (!row) throw new Error("Offering is outside the user's academic context.");
  return {
    program: { name: row.programName, shortName: row.programShortName },
    cohort: row.cohortName ? { name: row.cohortName } : null,
    period: { label: row.periodLabel },
    subject: { name: row.subjectName, shortName: row.subjectShortName },
  };
}

export function getOfferingStorageContextById(
  offeringId: number,
  connection: DatabaseConnection = getDatabase(),
): StorageLayoutContext {
  const row = connection.sqlite
    .prepare(
      `select p.name as programName, p.short_name as programShortName,
              so.class_group as classGroup, ap.label as periodLabel,
              s.name as subjectName, s.short_name as subjectShortName
       from subject_offerings so
       join programs p on p.id = so.program_id
       join academic_periods ap on ap.id = so.academic_period_id
       join subjects s on s.id = so.subject_id
       where so.id = ?`,
    )
    .get(z.number().int().positive().parse(offeringId)) as
    | {
        programName: string;
        programShortName: string | null;
        classGroup: string | null;
        periodLabel: string;
        subjectName: string;
        subjectShortName: string | null;
      }
    | undefined;
  if (!row) throw new Error("Offering not found.");
  return {
    program: { name: row.programName, shortName: row.programShortName },
    cohort: row.classGroup ? { name: row.classGroup } : null,
    period: { label: row.periodLabel },
    subject: { name: row.subjectName, shortName: row.subjectShortName },
  };
}
