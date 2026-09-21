import Link from "next/link";

import {
  addGroupMemberAction,
  createAudienceChatAction,
  createDirectChatAction,
  createGroupAction,
  removeGroupMemberAction,
} from "@/app/chat/actions";
import { ChatRoom } from "@/components/chat-room";
import { listUserSubjectOfferings } from "@/lib/academic";
import { resolveAcademicAdminContext } from "@/lib/academic-authority";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listChatMessages, listChatRooms, listChatRoomUsers } from "@/lib/chat";
import { renderChatMarkdown } from "@/lib/chat-markdown";
import { listGroupMembers, listVisibleUsers } from "@/lib/collaboration";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; group?: string }>;
}) {
  const user = await requireAuthenticatedUser();
  const params = await searchParams;
  const rooms = listChatRooms(user.id);
  const requested =
    params.room && /^\d+$/u.test(params.room) ? Number(params.room) : null;
  const groupRequested =
    params.group && /^\d+$/u.test(params.group) ? Number(params.group) : null;
  const selected =
    rooms.find(({ id }) => id === requested) ??
    rooms.find(({ groupId }) => groupId === groupRequested) ??
    rooms[0] ??
    null;
  const messages = selected
    ? listChatMessages(user.id, selected.id).map((message) => ({
        ...message,
        bodyHtml: renderChatMarkdown(message.bodySource),
      }))
    : [];
  const roomUsers = selected ? listChatRoomUsers(user.id, selected.id) : [];
  const visibleUsers = listVisibleUsers(user.id);
  const offerings = listUserSubjectOfferings(user.id);
  let audienceContext: ReturnType<typeof resolveAcademicAdminContext> | null =
    null;
  try {
    audienceContext = resolveAcademicAdminContext(user.id, null, null);
  } catch {
    audienceContext = null;
  }
  const groupMembers =
    selected?.kind === "group" && selected.groupId
      ? listGroupMembers(user.id, selected.groupId)
      : [];

  return (
    <div className="page-shell chat-page">
      <header className="page-titlebar">
        <div>
          <span className="eyebrow">COLLAB / CHAT</span>
          <h1>CHAT</h1>
        </div>
        <Link href="/settings?section=profile">Perfil</Link>
      </header>
      <div className="chat-layout">
        <aside className="chat-sidebar">
          <nav aria-label="Conversas">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/chat?room=${room.id}`}
                aria-current={selected?.id === room.id ? "page" : undefined}
              >
                <span>{room.kind.toUpperCase()}</span>
                <strong>{room.name}</strong>
              </Link>
            ))}
          </nav>
          <details>
            <summary>Nova conversa direta</summary>
            <form action={createDirectChatAction}>
              <select name="targetUserId" required>
                <option value="">Pessoa</option>
                {visibleUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.displayName}
                  </option>
                ))}
              </select>
              <button type="submit">Abrir conversa</button>
            </form>
          </details>
          <details>
            <summary>Novo grupo</summary>
            <form action={createGroupAction}>
              <input name="name" placeholder="Nome" maxLength={120} required />
              <textarea
                name="description"
                placeholder="Descrição"
                maxLength={500}
              />
              <select name="subjectOfferingId">
                <option value="">Sem disciplina</option>
                {offerings.map((offering) => (
                  <option key={offering.offeringId} value={offering.offeringId}>
                    {offering.subjectName}
                  </option>
                ))}
              </select>
              <fieldset>
                <legend>Membros</legend>
                {visibleUsers.map((candidate) => (
                  <label key={candidate.id}>
                    <input
                      type="checkbox"
                      name="memberUserId"
                      value={candidate.id}
                    />
                    {candidate.displayName}
                  </label>
                ))}
              </fieldset>
              <button type="submit">Criar grupo</button>
            </form>
          </details>
          {audienceContext ? (
            <details>
              <summary>Novo chat de audiência</summary>
              <form action={createAudienceChatAction}>
                <input
                  name="name"
                  placeholder="Nome"
                  maxLength={120}
                  required
                />
                <select name="audienceType" required>
                  {audienceContext.authority.role === "admin" ? (
                    <option value="instance">Toda a instância</option>
                  ) : null}
                  {audienceContext.authority.role !== "curator" ? (
                    <option value="program">Programa</option>
                  ) : null}
                  <option value="cohort">Turma</option>
                </select>
                <select name="programId">
                  <option value="">Programa</option>
                  {audienceContext.programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
                <select name="cohortId">
                  <option value="">Turma</option>
                  {audienceContext.cohorts.map((cohort) => (
                    <option key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
                <button type="submit">Criar audiência</button>
              </form>
            </details>
          ) : null}
        </aside>
        <main className="chat-main">
          {selected ? (
            <>
              <div className="chat-main-header">
                <h2>{selected.name}</h2>
                {selected.kind === "group" && selected.groupId ? (
                  <details className="chat-members-panel">
                    <summary>Membros ({groupMembers.length})</summary>
                    <div className="chat-members-popover">
                      <ul>
                        {groupMembers.map((member) => (
                          <li key={member.id}>
                            <Link href={`/profile/${member.id}`}>
                              {member.displayName}
                            </Link>
                            <span>{member.role}</span>
                            {member.role !== "owner" ? (
                              <form action={removeGroupMemberAction}>
                                <input
                                  type="hidden"
                                  name="roomId"
                                  value={selected.id}
                                />
                                <input
                                  type="hidden"
                                  name="groupId"
                                  value={selected.groupId ?? ""}
                                />
                                <input
                                  type="hidden"
                                  name="targetUserId"
                                  value={member.id}
                                />
                                <button type="submit">Remover</button>
                              </form>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <form action={addGroupMemberAction}>
                        <input
                          type="hidden"
                          name="roomId"
                          value={selected.id}
                        />
                        <input
                          type="hidden"
                          name="groupId"
                          value={selected.groupId}
                        />
                        <select name="targetUserId" required>
                          <option value="">Selecione uma pessoa</option>
                          {visibleUsers
                            .filter(
                              (candidate) =>
                                !groupMembers.some(
                                  ({ id }) => id === candidate.id,
                                ),
                            )
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.displayName}
                              </option>
                            ))}
                        </select>
                        <button type="submit">Adicionar membro</button>
                      </form>
                    </div>
                  </details>
                ) : null}
              </div>
              <ChatRoom
                key={selected.id}
                roomId={selected.id}
                initialMessages={messages}
                roomUsers={roomUsers}
                currentUserId={user.id}
              />
            </>
          ) : (
            <div className="useful-empty">
              <strong>Nenhuma conversa</strong>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
