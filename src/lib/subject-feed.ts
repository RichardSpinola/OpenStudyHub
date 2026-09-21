import { z } from "zod";

import {
  listUserSubjectOfferings,
  listUserSubjectTimeline,
} from "@/lib/academic";
import type { DatabaseConnection } from "@/lib/db/client";
import { getDatabase } from "@/lib/db/client";

const idSchema = z.number().int().positive();

export type SubjectFeedItem = {
  key: string;
  kind: "academic_event" | "activity" | "note" | "document" | "project";
  title: string;
  description: string | null;
  occurredAt: number;
  relevantAt: number;
  href: string | null;
  external: boolean;
  sourceLabel: string;
  status: string | null;
};

type ActivityFeedRow = {
  id: number;
  title: string;
  description: string | null;
  dueAt: number | null;
  createdAt: number;
  origin: "local" | "external";
  status: string;
  externalUrl: string | null;
};

type PrivateFeedRow = {
  id: number;
  title: string;
  createdAt: number;
};

export function listUserSubjectFeed(
  userId: number,
  subjectId: number,
  connection: DatabaseConnection = getDatabase(),
): SubjectFeedItem[] {
  const ownerId = idSchema.parse(userId);
  const targetSubjectId = idSchema.parse(subjectId);
  const offeringIds = listUserSubjectOfferings(ownerId, connection)
    .filter((offering) => offering.subjectId === targetSubjectId)
    .map((offering) => offering.offeringId);
  if (offeringIds.length === 0) return [];

  const activities = connection.sqlite
    .prepare(
      `select a.id, a.title, a.description, a.due_at as dueAt,
              a.created_at as createdAt, a.origin, a.status,
              a.external_url as externalUrl
       from activities a
       join subject_offerings so on so.id = a.offering_id
       where a.user_id = ? and so.subject_id = ? and a.status != 'archived'`,
    )
    .all(ownerId, targetSubjectId) as ActivityFeedRow[];
  const notes = connection.sqlite
    .prepare(
      `select n.id, n.title, n.created_at as createdAt
       from notes n
       join subject_offerings so on so.id = n.offering_id
       where n.owner_user_id = ? and so.subject_id = ?`,
    )
    .all(ownerId, targetSubjectId) as PrivateFeedRow[];
  const documents = connection.sqlite
    .prepare(
      `select gd.id, gd.name as title, gd.created_at as createdAt,
              gd.web_view_link as webViewLink
       from generated_documents gd
       join subject_offerings so on so.id = gd.offering_id
       where gd.owner_user_id = ? and so.subject_id = ?`,
    )
    .all(ownerId, targetSubjectId) as Array<
    PrivateFeedRow & { webViewLink: string }
  >;
  const projectVersions = connection.sqlite
    .prepare(
      `select pv.id, p.id as projectId, p.name as title,
              pv.version_number as versionNumber,
              pv.message as description, pv.created_at as createdAt
       from project_versions pv
       join projects p on p.id = pv.project_id
       join subject_offerings so on so.id = p.offering_id
       where p.owner_user_id = ? and so.subject_id = ?
       order by pv.created_at desc`,
    )
    .all(ownerId, targetSubjectId) as Array<
    PrivateFeedRow & {
      projectId: number;
      versionNumber: number;
      description: string | null;
    }
  >;

  return [
    ...listUserSubjectTimeline(ownerId, targetSubjectId, connection).map(
      (event): SubjectFeedItem => ({
        key: `event-${event.id}`,
        kind: "academic_event",
        title: event.title,
        description: event.description,
        occurredAt: event.startsAt,
        relevantAt: event.startsAt,
        href: null,
        external: false,
        sourceLabel: "Evento acadêmico",
        status: null,
      }),
    ),
    ...activities.map((activity): SubjectFeedItem => ({
      key: `activity-${activity.id}`,
      kind: "activity",
      title: activity.title,
      description: activity.description,
      occurredAt: activity.createdAt,
      relevantAt: activity.dueAt ?? activity.createdAt,
      href:
        activity.origin === "external" && activity.externalUrl
          ? activity.externalUrl
          : "/activities",
      external: activity.origin === "external",
      sourceLabel:
        activity.origin === "external" ? "Google Classroom" : "Atividade",
      status: activity.status,
    })),
    ...notes.map((note): SubjectFeedItem => ({
      key: `note-${note.id}`,
      kind: "note",
      title: note.title,
      description: null,
      occurredAt: note.createdAt,
      relevantAt: note.createdAt,
      href: `/notes/${note.id}`,
      external: false,
      sourceLabel: "Nota pessoal",
      status: null,
    })),
    ...documents.map((document): SubjectFeedItem => ({
      key: `document-${document.id}`,
      kind: "document",
      title: document.title,
      description: null,
      occurredAt: document.createdAt,
      relevantAt: document.createdAt,
      href: document.webViewLink,
      external: true,
      sourceLabel: "Google Docs",
      status: null,
    })),
    ...projectVersions.map((version): SubjectFeedItem => ({
      key: `project-version-${version.id}`,
      kind: "project",
      title: `${version.title} · v${String(version.versionNumber).padStart(4, "0")}`,
      description: version.description,
      occurredAt: version.createdAt,
      relevantAt: version.createdAt,
      href: `/projects/${version.projectId}`,
      external: false,
      sourceLabel: "Versão de projeto",
      status: null,
    })),
  ].sort(
    (left, right) =>
      right.occurredAt - left.occurredAt || left.key.localeCompare(right.key),
  );
}

export function findNextSubjectFeedItem(
  items: SubjectFeedItem[],
  now = Date.now(),
): SubjectFeedItem | null {
  return (
    items
      .filter(
        (item) =>
          item.relevantAt >= now &&
          (item.kind === "academic_event" || item.kind === "activity") &&
          !["completed", "submitted", "archived"].includes(item.status ?? ""),
      )
      .sort(
        (left, right) =>
          left.relevantAt - right.relevantAt ||
          left.key.localeCompare(right.key),
      )[0] ?? null
  );
}
