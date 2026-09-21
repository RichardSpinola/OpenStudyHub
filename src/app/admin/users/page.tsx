import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createMemberAction,
  createProfileTagAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserEnrollmentsAction,
  updateAcademicMembershipAction,
  updateFunctionalAuthorityAction,
} from "@/app/admin/users/actions";
import { listUsers } from "@/lib/access";
import { requireAcademicAdministrator } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { getUiLanguage } from "@/lib/ui-language";
import {
  listEnrollmentOfferings,
  listUserEnrollmentIds,
} from "@/lib/enrollments";
import { getAcademicMembership, listCohorts } from "@/lib/academic-membership";
import { getAdminAcademicData } from "@/lib/admin-academic";
import {
  getConfiguredAcademicAuthority,
  listManageableUserIds,
  resolveAcademicAdminContext,
} from "@/lib/academic-authority";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    programId?: string;
    cohortId?: string;
  }>;
}) {
  const actor = await requireAcademicAdministrator();
  const language = getUiLanguage();
  const { access, admin } = getTranslations(language);
  const parameters = await searchParams;
  const parseId = (value: string | undefined) =>
    value && /^\d+$/.test(value) ? Number(value) : null;
  let context;
  try {
    context = resolveAcademicAdminContext(
      actor.id,
      parseId(parameters.programId),
      parseId(parameters.cohortId),
    );
  } catch {
    redirect("/admin/users");
  }
  const isAdmin = context.authority.role === "admin";
  const manageableUserIds = new Set(listManageableUserIds(actor.id));
  const allUsers = listUsers();
  const users = allUsers.filter(({ id }) => {
    if (!isAdmin && !manageableUserIds.has(id)) return false;
    const membership = getAcademicMembership(id);
    if (!membership) return isAdmin;
    if (membership.programId !== context.selectedProgramId) return false;
    return (
      context.selectedCohortId === null ||
      membership.cohortId === context.selectedCohortId
    );
  });
  const authorities = new Map(
    users.map((user) => [user.id, getConfiguredAcademicAuthority(user.id)]),
  );
  const offerings = listEnrollmentOfferings().filter(
    ({ programId }) => programId === context.selectedProgramId,
  );
  const allPrograms = getAdminAcademicData().programs;
  const programs = allPrograms.filter(({ id }) =>
    context.programs.some((program) => program.id === id),
  );
  const allCohorts = listCohorts();
  const cohorts = allCohorts.filter(({ id }) =>
    context.cohorts.some((cohort) => cohort.id === id),
  );
  const status = parameters.status;

  return (
    <div className="admin-shell">
      <header className="admin-heading">
        <div>
          <span>{admin.system}</span>
          <h1>{admin.usersTitle}</h1>
          <p className="page-description">
            Contas, matrículas e permissões dentro do contexto selecionado.
          </p>
        </div>
        <Link href="/admin">← {admin.back}</Link>
      </header>

      {status === "error" ? (
        <p className="admin-feedback form-error" role="alert">
          {admin.actionError}
        </p>
      ) : null}
      {status === "ok" ? (
        <p className="admin-feedback feedback-banner is-success" role="status">
          {admin.actionSuccess}
        </p>
      ) : null}

      <form method="get" className="admin-context-selector">
        <label>
          {admin.program}
          <select
            name="programId"
            defaultValue={context.selectedProgramId ?? ""}
            required
          >
            {context.programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {admin.cohort}
          <select name="cohortId" defaultValue={context.selectedCohortId ?? ""}>
            <option value="">{admin.allCohorts}</option>
            {context.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{admin.applyContext}</button>
      </form>

      {isAdmin ? (
        <section className="admin-panel">
          <div className="section-heading">
            <span className="panel-index">01</span>
            <h2>{admin.createMember}</h2>
          </div>
          <form action={createMemberAction} className="admin-inline-form">
            <label>
              {access.displayName}
              <input
                name="displayName"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              {access.login}
              <input
                name="login"
                minLength={3}
                maxLength={120}
                autoComplete="off"
                required
              />
            </label>
            <label>
              {access.password}
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <button type="submit">{admin.create}</button>
          </form>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="section-heading">
          <span className="panel-index">02</span>
          <h2>Visual Tags</h2>
        </div>
        <p className="panel-help">
          Tags são rótulos de perfil. Elas não concedem acesso a grupos, notas,
          documentos ou chats.
        </p>
        <details className="admin-record-editor">
          <summary>[ Criar Visual Tag ]</summary>
          <form action={createProfileTagAction} className="admin-edit-form">
            <label>
              Rótulo
              <input name="label" maxLength={40} required />
            </label>
            <label>
              Escopo
              <select name="scopeType">
                {context.authority.role === "admin" ? (
                  <option value="instance">Instância</option>
                ) : null}
                {context.authority.role !== "curator" ? (
                  <option value="program">Programa</option>
                ) : null}
                <option value="cohort">Turma</option>
              </select>
            </label>
            <label>
              Programa
              <select name="programId" defaultValue="">
                <option value="">Selecione quando aplicável</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Turma
              <select name="cohortId" defaultValue="">
                <option value="">Selecione quando aplicável</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.programName} / {cohort.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="selfAssignable" value="true" />
              Usuários elegíveis podem adicionar ao próprio perfil
            </label>
            <button type="submit">Criar tag</button>
          </form>
        </details>
      </section>

      <section className="admin-panel">
        <div className="section-heading">
          <span className="panel-index">03</span>
          <h2>{admin.users}</h2>
          <span className="count-label">{users.length}</span>
        </div>
        <ol className="admin-record-list">
          {users.map((user) => (
            <li key={user.id}>
              <div className="admin-record-summary">
                <span>{String(user.id).padStart(2, "0")}</span>
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.login}</small>
                </div>
                <span>{authorities.get(user.id)?.role.toUpperCase()}</span>
                <span>{user.active ? admin.active : admin.disabled}</span>
              </div>
              {isAdmin ? (
                <div className="admin-record-actions">
                  <form action={setUserActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={user.active ? "false" : "true"}
                    />
                    <button type="submit">
                      {user.active ? admin.disable : admin.enable}
                    </button>
                  </form>
                  <details>
                    <summary>[ {admin.resetPassword} ]</summary>
                    <form action={resetUserPasswordAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <label>
                        {access.password}
                        <input
                          name="password"
                          type="password"
                          minLength={12}
                          maxLength={128}
                          autoComplete="new-password"
                          required
                        />
                      </label>
                      <button type="submit">{admin.resetPassword}</button>
                    </form>
                  </details>
                </div>
              ) : null}
              {isAdmin ? (
                <details className="admin-record-editor">
                  <summary>[ {admin.administrativeAuthority} ]</summary>
                  <form
                    action={updateFunctionalAuthorityAction}
                    className="admin-edit-form authority-form"
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    <label>
                      {admin.functionalRole}
                      <select
                        name="functionalRole"
                        defaultValue={authorities.get(user.id)?.role}
                      >
                        <option value="user">USER</option>
                        <option value="curator">CURATOR</option>
                        <option value="moderator">MODERATOR</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    </label>
                    <fieldset>
                      <legend>{admin.programScopes}</legend>
                      {allPrograms.map((program) => (
                        <label key={program.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            name="programScopeId"
                            value={program.id}
                            defaultChecked={
                              authorities.get(user.id)?.role === "moderator" &&
                              authorities
                                .get(user.id)
                                ?.programIds.includes(program.id)
                            }
                          />
                          {program.name}
                        </label>
                      ))}
                    </fieldset>
                    <fieldset aria-label={admin.cohortScopes}>
                      {allCohorts.map((cohort) => (
                        <label key={cohort.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            name="cohortScopeId"
                            value={cohort.id}
                            defaultChecked={
                              authorities.get(user.id)?.role === "curator" &&
                              authorities
                                .get(user.id)
                                ?.cohortIds.includes(cohort.id)
                            }
                          />
                          {cohort.programName} / {cohort.name}
                        </label>
                      ))}
                    </fieldset>
                    <button type="submit">{admin.saveAuthority}</button>
                  </form>
                </details>
              ) : null}
              <details className="admin-record-editor">
                <summary>[ {admin.academicMembership} ]</summary>
                <form
                  action={updateAcademicMembershipAction}
                  className="admin-edit-form"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <label>
                    {admin.program}
                    <select
                      name="programId"
                      defaultValue={
                        getAcademicMembership(user.id)?.programId ?? ""
                      }
                    >
                      {context.authority.role === "curator" ? null : (
                        <option value="">{admin.noAcademicContext}</option>
                      )}
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {admin.cohort}
                    <select
                      name="cohortId"
                      defaultValue={
                        getAcademicMembership(user.id)?.cohortId ?? ""
                      }
                    >
                      {context.authority.role === "curator" ? null : (
                        <option value="">{admin.noCohort}</option>
                      )}
                      {cohorts.map((cohort) => (
                        <option key={cohort.id} value={cohort.id}>
                          {cohort.programName} / {cohort.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">{admin.saveAcademicContext}</button>
                </form>
              </details>
              {context.authority.role !== "curator" ? (
                <details className="admin-record-editor">
                  <summary>[ {admin.enrollments} ]</summary>
                  <form
                    action={updateUserEnrollmentsAction}
                    className="enrollment-form"
                  >
                    <input type="hidden" name="userId" value={user.id} />
                    {offerings
                      .filter(
                        ({ programId }) =>
                          programId ===
                          getAcademicMembership(user.id)?.programId,
                      )
                      .map((offering) => (
                        <label key={offering.offeringId}>
                          <input
                            type="checkbox"
                            name="offeringId"
                            value={offering.offeringId}
                            defaultChecked={listUserEnrollmentIds(
                              user.id,
                            ).includes(offering.offeringId)}
                          />
                          <span>
                            {offering.subjectCode ?? "—"} /{" "}
                            {offering.subjectName} / {offering.periodLabel}
                          </span>
                        </label>
                      ))}
                    <button
                      type="submit"
                      disabled={getAcademicMembership(user.id) === null}
                    >
                      {admin.saveEnrollments}
                    </button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
