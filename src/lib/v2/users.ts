import type { Actor } from "./actor";
import { randomBytes, createHash } from "node:crypto";
import { hashPassword } from "../password";
import type { V2Database } from "./database";
import { isAdmin, canManage } from "./access";
import { recordAdminAction } from "./audit";

function admin(db: V2Database, actor: Actor) {
  if (!isAdmin(db, actor))
    throw new Error("Somente Admin da instância pode administrar usuários.");
}
export async function createV2User(
  db: V2Database,
  actor: Actor,
  login: string,
  name: string,
  password: string,
): Promise<number> {
  admin(db, actor);
  if (
    !/^[a-z0-9._-]{3,64}$/i.test(login) ||
    name.trim().length < 2 ||
    password.length < 12
  )
    throw new Error("Dados de usuário inválidos.");
  const hash = await hashPassword(password);
  return db.transaction(() => {
    const id = Number(
      db
        .prepare(
          "INSERT INTO users(login,display_name,password_hash,must_change_password) VALUES(?,?,?,1)",
        )
        .run(login.trim(), name.trim(), hash).lastInsertRowid,
    );
    recordAdminAction(db, actor, "user.create", "user", id);
    return id;
  })();
}
export function editV2User(
  db: V2Database,
  actor: Actor,
  id: number,
  name: string,
  active: boolean,
): void {
  admin(db, actor);
  if (name.trim().length < 2) throw new Error("Nome curto demais.");
  db.transaction(() => {
    const before = db.prepare("SELECT active FROM users WHERE id=?").get(id) as
      { active: number } | undefined;
    if (!before) throw new Error("Usuário não encontrado.");
    db.prepare("UPDATE users SET display_name=?,active=? WHERE id=?").run(
      name.trim(),
      active ? 1 : 0,
      id,
    );
    if (!active)
      db.prepare(
        "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",
      ).run(Date.now(), id);
    recordAdminAction(
      db,
      actor,
      active ? "user.edit_or_reactivate" : "user.deactivate",
      "user",
      id,
    );
  })();
}

const removableUserState = new Set([
  "user_sessions",
  "user_appearance",
  "user_home_background_choice",
]);

export function previewDeleteV2User(db: V2Database, actor: Actor, id: number) {
  admin(db, actor);
  const user = db.prepare("SELECT id,login FROM users WHERE id=?").get(id) as
    { id: number; login: string } | undefined;
  if (!user) throw new Error("Usuário não encontrado.");
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>;
  const dependencies: Array<{ table: string; count: number }> = [];
  for (const { name } of tables) {
    const foreignKeys = db.pragma(
      `foreign_key_list("${name.replaceAll('"', '""')}")`,
    ) as Array<{ table: string; from: string; to: string }>;
    for (const key of foreignKeys) {
      if (key.table !== "users" || key.to !== "id") continue;
      const count = (
        db
          .prepare(
            `SELECT count(*) n FROM "${name.replaceAll('"', '""')}" WHERE "${key.from.replaceAll('"', '""')}"=?`,
          )
          .get(id) as { n: number }
      ).n;
      if (count && !removableUserState.has(name))
        dependencies.push({ table: name, count });
    }
  }
  return { user, dependencies, canDelete: dependencies.length === 0 };
}

export function deleteV2User(
  db: V2Database,
  actor: Actor,
  id: number,
  confirmation: string,
) {
  admin(db, actor);
  return db.transaction(() => {
    const preview = previewDeleteV2User(db, actor, id);
    if (confirmation !== preview.user.login)
      throw new Error("Digite o login exato para confirmar a exclusão.");
    if (!preview.canDelete)
      throw new Error(
        `Esta conta possui ${preview.dependencies.reduce((sum, item) => sum + item.count, 0)} vínculo(s) que impedem exclusão. Desative a conta para impedir acesso.`,
      );
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    for (const name of removableUserState) {
      if (tables.some((table) => table.name === name))
        db.prepare(`DELETE FROM "${name}" WHERE user_id=?`).run(id);
    }
    db.prepare("DELETE FROM users WHERE id=?").run(id);
    recordAdminAction(
      db,
      actor,
      "user.delete_without_dependencies",
      "user",
      id,
    );
  })();
}
function canEnrollUser(
  db: V2Database,
  actor: Actor,
  userId: number,
  offeringId: number,
): boolean {
  const offering = db
    .prepare(
      "SELECT program_id FROM offerings WHERE id=? AND archived_at IS NULL",
    )
    .get(offeringId) as { program_id: number } | undefined;
  if (!offering) return false;
  if (
    canManage(db, actor, "manage_enrollments", {
      kind: "offering",
      id: offeringId,
    })
  )
    return true;
  const contexts = db
    .prepare(
      "SELECT DISTINCT x.cohort_id cohortId FROM user_academic_contexts x JOIN offering_cohorts oc ON oc.cohort_id=x.cohort_id WHERE x.user_id=? AND x.current=1 AND oc.offering_id=?",
    )
    .all(userId, offeringId) as Array<{ cohortId: number }>;
  return contexts.some((c) =>
    canManage(db, actor, "manage_enrollments", {
      kind: "cohort",
      id: c.cohortId,
    }),
  );
}
export function enrollV2(
  db: V2Database,
  actor: Actor,
  userId: number,
  offeringId: number,
): void {
  if (!canEnrollUser(db, actor, userId, offeringId))
    throw new Error("Sem permissão para matrículas neste escopo.");
  if (!db.prepare("SELECT 1 FROM users WHERE id=? AND active=1").get(userId))
    throw new Error("Usuário indisponível.");
  db.transaction(() => {
    const old = db
      .prepare(
        "SELECT id,withdrawn_at FROM enrollments WHERE user_id=? AND offering_id=?",
      )
      .get(userId, offeringId) as
      { id: number; withdrawn_at: number | null } | undefined;
    if (old && !old.withdrawn_at) throw new Error("Estudante já matriculado.");
    if (old)
      db.prepare("UPDATE enrollments SET withdrawn_at=NULL WHERE id=?").run(
        old.id,
      );
    else
      db.prepare(
        "INSERT INTO enrollments(user_id,offering_id,source) VALUES(?,?,'exception')",
      ).run(userId, offeringId);
    recordAdminAction(db, actor, "enrollment.create", "offering", offeringId);
  })();
}
export function withdrawEnrollment(
  db: V2Database,
  actor: Actor,
  id: number,
): void {
  const row = db
    .prepare(
      "SELECT e.user_id userId,e.offering_id offeringId FROM enrollments e WHERE e.id=? AND e.withdrawn_at IS NULL",
    )
    .get(id) as { userId: number; offeringId: number } | undefined;
  if (!row) throw new Error("Matrícula ativa não encontrada.");
  if (!canEnrollUser(db, actor, row.userId, row.offeringId))
    throw new Error("Sem permissão para esta matrícula.");
  db.transaction(() => {
    db.prepare("UPDATE enrollments SET withdrawn_at=? WHERE id=?").run(
      Date.now(),
      id,
    );
    recordAdminAction(db, actor, "enrollment.withdraw", "enrollment", id);
  })();
}
export function previewCohortEnrollment(
  db: V2Database,
  actor: Actor,
  cohortId: number,
  offeringId: number,
) {
  if (
    !canManage(db, actor, "manage_enrollments", {
      kind: "cohort",
      id: cohortId,
    })
  )
    throw new Error("Sem permissão para esta turma.");
  if (
    !db
      .prepare(
        "SELECT 1 FROM offering_cohorts WHERE cohort_id=? AND offering_id=?",
      )
      .get(cohortId, offeringId)
  )
    throw new Error("A turma da disciplina não está vinculada a esta turma.");
  const users = db
    .prepare(
      "SELECT DISTINCT u.id FROM user_academic_contexts x JOIN users u ON u.id=x.user_id WHERE x.cohort_id=? AND x.current=1 AND u.active=1",
    )
    .all(cohortId) as Array<{ id: number }>;
  const pending = users.filter(
    (u) =>
      !db
        .prepare(
          "SELECT 1 FROM enrollments WHERE user_id=? AND offering_id=? AND withdrawn_at IS NULL",
        )
        .get(u.id, offeringId),
  );
  return {
    total: users.length,
    pending: pending.length,
    userIds: pending.map((u) => u.id),
  };
}
export function enrollCohort(
  db: V2Database,
  actor: Actor,
  cohortId: number,
  offeringId: number,
  confirmation: string,
) {
  return db.transaction(() => {
    const preview = previewCohortEnrollment(db, actor, cohortId, offeringId);
    if (confirmation !== `MATRICULAR ${preview.pending}`)
      throw new Error("Confirmação do lote incorreta.");
    for (const id of preview.userIds) {
      const old = db
        .prepare("SELECT id FROM enrollments WHERE user_id=? AND offering_id=?")
        .get(id, offeringId) as { id: number } | undefined;
      if (old)
        db.prepare(
          "UPDATE enrollments SET withdrawn_at=NULL,source='cohort' WHERE id=?",
        ).run(old.id);
      else
        db.prepare(
          "INSERT INTO enrollments(user_id,offering_id,source) VALUES(?,?,'cohort')",
        ).run(id, offeringId);
    }
    recordAdminAction(
      db,
      actor,
      "enrollment.cohort_batch",
      "offering",
      offeringId,
    );
    return preview;
  })();
}
function parseCsv(input: string): string[][] {
  if (input.length > 200_000) throw new Error("CSV excede 200 KB.");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}
export type CsvPreview = {
  valid: Array<{ line: number; login: string; name: string }>;
  errors: Array<{ line: number; reason: string }>;
  fingerprint: string;
};
export function previewUsersCsv(
  db: V2Database,
  actor: Actor,
  csv: string,
): CsvPreview {
  admin(db, actor);
  const rows = parseCsv(csv);
  const fingerprint = createHash("sha256").update(csv).digest("hex");
  if (rows.length > 1001)
    throw new Error("Limite de 1000 usuários por arquivo.");
  const valid: CsvPreview["valid"] = [],
    errors: CsvPreview["errors"] = [];
  if (rows[0]?.map((x) => x.trim().toLowerCase()).join(",") !== "login,nome")
    errors.push({ line: 1, reason: "Cabeçalho esperado: login,nome" });
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const [rawLogin, rawName, ...extra] = rows[i];
    const login = rawLogin?.trim().toLowerCase() ?? "";
    const name = rawName?.trim() ?? "";
    let reason = "";
    if (
      extra.length ||
      !/^[a-z0-9._-]{3,64}$/.test(login) ||
      name.length < 2 ||
      name.length > 120
    )
      reason = "Login ou nome inválido, ou colunas extras.";
    else if (seen.has(login)) reason = "Login duplicado no CSV.";
    else if (db.prepare("SELECT 1 FROM users WHERE lower(login)=?").get(login))
      reason = "Login já existe.";
    seen.add(login);
    if (reason) errors.push({ line: i + 1, reason });
    else valid.push({ line: i + 1, login, name });
  }
  if (!rows.length || rows.length === 1)
    errors.push({ line: 1, reason: "Arquivo sem usuários." });
  return { valid, errors, fingerprint };
}
export async function applyUsersCsv(
  db: V2Database,
  actor: Actor,
  csv: string,
  fingerprint: string,
): Promise<Array<{ login: string; temporaryPassword: string }>> {
  const preview = previewUsersCsv(db, actor, csv);
  if (
    preview.fingerprint !== fingerprint ||
    preview.errors.length ||
    !preview.valid.length
  )
    throw new Error(
      "Revise o CSV antes de aplicar. Nenhuma linha foi importada.",
    );
  const prepared = await Promise.all(
    preview.valid.map(async (r) => {
      const temporaryPassword = randomBytes(18).toString("base64url");
      return {
        ...r,
        temporaryPassword,
        hash: await hashPassword(temporaryPassword),
      };
    }),
  );
  return db.transaction(() => {
    const again = previewUsersCsv(db, actor, csv);
    if (again.errors.length || again.fingerprint !== fingerprint)
      throw new Error("CSV mudou; faça o preview novamente.");
    const insert = db.prepare(
      "INSERT INTO users(login,display_name,password_hash,must_change_password) VALUES(?,?,?,1)",
    );
    for (const r of prepared) {
      const id = Number(insert.run(r.login, r.name, r.hash).lastInsertRowid);
      recordAdminAction(db, actor, "user.csv_create", "user", id);
    }
    return prepared.map(({ login, temporaryPassword }) => ({
      login,
      temporaryPassword,
    }));
  })();
}
