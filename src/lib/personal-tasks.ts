import { z } from "zod";
import { getDatabase, type DatabaseConnection } from "./db/client";
import { personalPlanningContext } from "./personal-planning-context";

export type PersonalTask = {
  id: number;
  title: string;
  description: string;
  offeringKey: string | null;
  dueAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
};
const owner = z.number().int().positive();
export const personalTaskInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).default(""),
  offeringKey: z
    .string()
    .regex(/^v[12]:[1-9]\d*$/)
    .nullable()
    .default(null),
  dueAt: z.number().int().min(0).max(253402300799999).nullable().default(null),
});
const columns =
  "id,title,description,offering_key offeringKey,due_at dueAt,completed_at completedAt,created_at createdAt,updated_at updatedAt";
export function listPersonalTasks(
  userId: number,
  connection: DatabaseConnection = getDatabase(),
): PersonalTask[] {
  return connection.sqlite
    .prepare(
      `SELECT ${columns} FROM personal_tasks WHERE user_id=? ORDER BY completed_at IS NOT NULL,due_at IS NULL,due_at,created_at DESC,id DESC`,
    )
    .all(owner.parse(userId)) as PersonalTask[];
}
export function savePersonalTask(
  userId: number,
  input: z.input<typeof personalTaskInput>,
  id?: number,
  connection: DatabaseConnection = getDatabase(),
) {
  owner.parse(userId);
  const value = personalTaskInput.parse(input),
    now = Date.now();
  if (
    value.offeringKey &&
    !personalPlanningContext(userId, connection).offerings.some(
      (o) => o.key === value.offeringKey,
    )
  )
    throw new Error("offering");
  if (id !== undefined) {
    const result = connection.sqlite
      .prepare(
        "UPDATE personal_tasks SET title=?,description=?,offering_key=?,due_at=?,updated_at=? WHERE id=? AND user_id=?",
      )
      .run(
        value.title,
        value.description,
        value.offeringKey,
        value.dueAt,
        now,
        owner.parse(id),
        userId,
      );
    if (!result.changes) throw new Error("not-found");
    return id;
  }
  return connection.sqlite.transaction(() => {
    const count = connection.sqlite
      .prepare("SELECT count(*) n FROM personal_tasks WHERE user_id=?")
      .get(userId) as { n: number };
    if (count.n >= 1000) throw new Error("limit");
    return Number(
      connection.sqlite
        .prepare(
          "INSERT INTO personal_tasks(user_id,title,description,offering_key,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          userId,
          value.title,
          value.description,
          value.offeringKey,
          value.dueAt,
          now,
          now,
        ).lastInsertRowid,
    );
  })();
}
export function setPersonalTaskCompleted(
  userId: number,
  id: number,
  completed: boolean,
  connection: DatabaseConnection = getDatabase(),
) {
  const now = Date.now();
  const result = connection.sqlite
    .prepare(
      "UPDATE personal_tasks SET completed_at=?,updated_at=? WHERE id=? AND user_id=?",
    )
    .run(completed ? now : null, now, owner.parse(id), owner.parse(userId));
  if (!result.changes) throw new Error("not-found");
}
export function deletePersonalTask(
  userId: number,
  id: number,
  connection: DatabaseConnection = getDatabase(),
) {
  const result = connection.sqlite
    .prepare("DELETE FROM personal_tasks WHERE id=? AND user_id=?")
    .run(owner.parse(id), owner.parse(userId));
  if (!result.changes) throw new Error("not-found");
}
