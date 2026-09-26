import { UiCopy } from "@/components/ui-language-provider";
import Link from "next/link";
import { IconMessages } from "@tabler/icons-react";

import {
  addGroupMemberAction,
  removeGroupMemberAction,
  personalChatAction,
  leaveGroupAction,
  closeGroupAction,
  chatRoomAvatarAction,
} from "@/app/chat/actions";
import { ChatRoom } from "@/components/chat-room";
import { ChatCreateDialog } from "@/components/chat-create-dialog";
import { ChatWallpaperSettings } from "@/components/chat-wallpaper-settings";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { DismissibleDetails } from "@/components/dismissible-details";
import {
  ChatContextLayout,
  ChatContextToggle,
  ChatContextClose,
} from "@/components/chat-context-layout";
import { ChatParticipantPanel } from "@/components/chat-participant-panel";
import { listUserSubjectOfferings } from "@/lib/academic";
import { resolveAcademicAdminContext } from "@/lib/academic-authority";
import { requireAuthenticatedUser } from "@/lib/authorization";
import { listChatMessages, listChatRoomUsers } from "@/lib/chat";
import { chatWallpaper, listChatRoomSummaries } from "@/lib/v2/chat-state";
import { canManageChatRoomAvatar } from "@/lib/v2/chat-room-avatar";
import { renderChatMarkdown } from "@/lib/chat-markdown";
import { listGroupMembers, listVisibleUsers } from "@/lib/collaboration";
import { getUserProfile } from "@/lib/profile";
import { uiText } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{
    room?: string;
    group?: string;
    archived?: string;
    q?: string;
    wallpaper?: string;
    avatar?: string;
  }>;
}) {
  const user = await requireAuthenticatedUser();
  const language = getUserProfile(user.id).locale;
  const tr = (pt: string, en: string) => uiText(language, pt, en);
  const params = await searchParams;
  const rooms = listChatRoomSummaries(user.id);
  const archivedView = params.archived === "1";
  const query = (params.q || "").trim().toLocaleLowerCase("pt-BR").slice(0, 80);
  const displayedRooms = rooms.filter(
    (room) =>
      !room.closed &&
      room.archived === archivedView &&
      (!query || room.name.toLocaleLowerCase("pt-BR").includes(query)),
  );
  const requested =
    params.room && /^\d+$/u.test(params.room) ? Number(params.room) : null;
  const groupRequested =
    params.group && /^\d+$/u.test(params.group) ? Number(params.group) : null;
  const selected =
    displayedRooms.find(({ id }) => id === requested) ??
    displayedRooms.find(({ groupId }) => groupId === groupRequested) ??
    displayedRooms[0] ??
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
  const wallpaper = chatWallpaper(user.id);
  const canEditRoomAvatar = selected
    ? canManageChatRoomAvatar(user.id, selected.id)
    : false;
  const globalRoom = displayedRooms.filter(
    (room) => room.kind === "audience" && room.name === "Global",
  );
  const directRooms = displayedRooms.filter((room) => room.kind === "direct");
  const groupRooms = displayedRooms.filter(
    (room) =>
      room.kind === "group" ||
      (room.kind === "audience" && room.name !== "Global"),
  );
  const formatTime = (value: number | null) =>
    value
      ? new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(value)
      : "";
  const roomLink = (room: (typeof rooms)[number]) => (
    <Link
      key={room.id}
      href={`/chat?room=${room.id}${archivedView ? "&archived=1" : ""}`}
      aria-current={selected?.id === room.id ? "page" : undefined}
      className="chat-conversation-link"
    >
      <span className="chat-list-avatar" aria-hidden="true">
        {room.kind !== "direct" && room.avatarVersion ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/chat-room-avatar/${room.id}?v=${room.avatarVersion}`}
            alt=""
          />
        ) : room.peer?.hasAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/profile-media/${room.peer.id}/avatar`} alt="" />
        ) : room.kind === "audience" ? (
          <IconMessages size={22} stroke={1.7} />
        ) : room.kind === "group" ? (
          "◇"
        ) : (
          room.name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="chat-list-copy">
        <strong>{room.name}</strong>
        <small>
          {room.lastMessagePreview ||
            tr("Comece a conversa", "Start the conversation")}
        </small>
      </span>
      <span className="chat-list-meta">
        <time>{formatTime(room.lastMessageAt)}</time>
        {room.unreadCount ? (
          <b
            aria-label={tr(
              `${room.unreadCount} não lidas`,
              `${room.unreadCount} unread`,
            )}
          >
            {room.unreadCount}
          </b>
        ) : null}
      </span>
    </Link>
  );

  return (
    <div
      className="chat-page"
      data-mobile-conversation={Boolean(params.room || params.group)}
    >
      <ChatContextLayout key={selected?.id ?? "empty"}>
        <aside className="chat-sidebar">
          <div className="chat-sidebar-heading">
            <h1>
              <UiCopy pt="Mensagens" en="Messages" />
            </h1>
            <span>
              {rooms.filter(({ closed }) => !closed).length}
              <UiCopy pt="conversas" en="conversations" />
            </span>
          </div>
          <ChatCreateDialog
            people={visibleUsers}
            offerings={offerings}
            audience={
              audienceContext && audienceContext.authority.role !== "user"
                ? {
                    role: audienceContext.authority.role,
                    programs: audienceContext.programs,
                    cohorts: audienceContext.cohorts,
                  }
                : null
            }
          />
          <form className="chat-search" action="/chat" method="get">
            <label htmlFor="chat-search">
              <UiCopy pt="Buscar conversas" en="Search conversations" />
            </label>
            <input
              id="chat-search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Nome da pessoa ou grupo"
            />
            <button type="submit">
              <UiCopy pt="Buscar" en="Search" />
            </button>
          </form>
          <nav className="chat-list" aria-label="Conversas">
            {globalRoom.length ? (
              <section aria-label="Global">
                <h2>GLOBAL</h2>
                {globalRoom.map(roomLink)}
              </section>
            ) : null}
            {directRooms.length ? (
              <section aria-label="Conversas diretas">
                <h2>
                  <UiCopy pt="DIRETAS" en="DIRECT" />
                </h2>
                {directRooms.map(roomLink)}
              </section>
            ) : null}
            {groupRooms.length ? (
              <section aria-label="Grupos">
                <h2>
                  <UiCopy pt="GRUPOS" en="GROUPS" />
                </h2>
                {groupRooms.map(roomLink)}
              </section>
            ) : null}
            {!displayedRooms.length ? (
              <p className="chat-list-empty">
                {query
                  ? "Nenhuma conversa encontrada."
                  : "Nenhuma conversa nesta lista."}
              </p>
            ) : null}
          </nav>
          <Link
            className="chat-archive-link"
            href={archivedView ? "/chat" : "/chat?archived=1"}
          >
            {archivedView ? "← Conversas ativas" : "Conversas arquivadas →"}
          </Link>
        </aside>
        <main className="chat-main">
          {selected ? (
            <>
              <div className="chat-main-header">
                <Link
                  className="chat-mobile-back"
                  href={archivedView ? "/chat?archived=1" : "/chat"}
                >
                  <UiCopy pt="← Conversas" en="← Conversations" />
                </Link>
                <ChatContextToggle>
                  {selected.kind !== "direct" && selected.avatarVersion ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/chat-room-avatar/${selected.id}?v=${selected.avatarVersion}`}
                      alt=""
                      loading="eager"
                    />
                  ) : selected.peer?.hasAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/profile-media/${selected.peer.id}/avatar`}
                      alt=""
                    />
                  ) : (
                    <span className="chat-header-avatar" aria-hidden="true">
                      {selected.kind === "audience" ? (
                        <IconMessages size={22} stroke={1.7} />
                      ) : (
                        selected.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                  )}
                  <span className="chat-header-copy">
                    <strong className="chat-header-title">
                      {selected.name}
                    </strong>
                    <small>
                      {selected.kind === "direct"
                        ? tr("Conversa direta", "Direct conversation")
                        : selected.kind === "group"
                          ? tr("Grupo", "Group")
                          : tr("Espaço da comunidade", "Community space")}
                    </small>
                  </span>
                </ChatContextToggle>
                <div className="chat-header-actions">
                  <DismissibleDetails className="chat-room-more">
                    <summary
                      aria-label={tr(
                        "Mais opções da conversa",
                        "More conversation options",
                      )}
                    >
                      ⋯
                    </summary>
                    <div>
                      <a href={`/chat/${selected.id}/export`}>
                        <UiCopy pt="Exportar" en="Export" />
                      </a>
                      {selected.kind === "group" && selected.groupId ? (
                        <details className="chat-members-panel">
                          <summary>
                            {groupMembers.length}
                            <UiCopy pt="membros" en="members" />
                          </summary>
                          <div className="chat-members-popover">
                            <p>
                              <UiCopy
                                pt="Quem participa deste grupo"
                                en="Group participants"
                              />
                            </p>
                            <ul>
                              {groupMembers.map((member) => (
                                <li key={member.id}>
                                  <Link
                                    href={`/profile/${member.id}?from=chat&room=${selected.id}`}
                                  >
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
                                      <button type="submit">
                                        <UiCopy pt="Remover" en="Remove" />
                                      </button>
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
                                <option value="">
                                  <UiCopy
                                    pt="Selecione uma pessoa"
                                    en="Select a person"
                                  />
                                </option>
                                {visibleUsers
                                  .filter(
                                    (candidate) =>
                                      !groupMembers.some(
                                        ({ id }) => id === candidate.id,
                                      ),
                                  )
                                  .map((candidate) => (
                                    <option
                                      key={candidate.id}
                                      value={candidate.id}
                                    >
                                      {candidate.displayName}
                                    </option>
                                  ))}
                              </select>
                              <button type="submit">
                                <UiCopy pt="Adicionar membro" en="Add member" />
                              </button>
                            </form>
                            {groupMembers.some(
                              (member) =>
                                member.id === user.id &&
                                member.role === "member",
                            ) ? (
                              <form action={leaveGroupAction}>
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
                                <ConfirmSubmitButton
                                  confirmation={tr(
                                    "Sair do grupo? Você perde acesso à conversa até receber novo convite.",
                                    "Leave the group? You will lose access until you receive a new invitation.",
                                  )}
                                >
                                  <UiCopy pt="Sair do grupo" en="Leave group" />
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                            {groupMembers.some(
                              (member) =>
                                member.id === user.id &&
                                member.role === "owner",
                            ) ? (
                              <form action={closeGroupAction}>
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
                                <ConfirmSubmitButton
                                  confirmation={tr(
                                    "Encerrar este grupo para todos? O histórico será preservado, mas a conversa ficará indisponível.",
                                    "Close this group for everyone? Its history will be preserved, but the conversation will be unavailable.",
                                  )}
                                >
                                  <UiCopy
                                    pt="Encerrar grupo"
                                    en="Close group"
                                  />
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </details>
                      ) : null}

                      <details className="chat-more-wallpaper">
                        <summary>
                          <UiCopy
                            pt="Fundo da conversa"
                            en="Conversation background"
                          />
                        </summary>
                        <ChatWallpaperSettings
                          roomId={selected.id}
                          wallpaper={wallpaper.preset}
                          version={wallpaper.updatedAt}
                          status={params.wallpaper}
                        />
                      </details>
                      {canEditRoomAvatar ? (
                        <form
                          action={chatRoomAvatarAction}
                          className="chat-room-avatar-form"
                        >
                          <input
                            type="hidden"
                            name="roomId"
                            value={selected.id}
                          />
                          <label>
                            <UiCopy
                              pt="Imagem da conversa"
                              en="Conversation image"
                            />
                            <input
                              type="file"
                              name="avatar"
                              accept="image/png,image/jpeg,image/webp"
                              required
                            />
                          </label>
                          <small>
                            <UiCopy
                              pt="PNG, JPEG ou WebP · até 5 MiB."
                              en="PNG, JPEG or WebP · up to 5 MiB."
                            />
                          </small>
                          <PendingSubmitButton
                            pendingLabel={
                              <UiCopy
                                pt="Salvando imagem…"
                                en="Saving image…"
                              />
                            }
                          >
                            <UiCopy pt="Salvar imagem" en="Save image" />
                          </PendingSubmitButton>
                        </form>
                      ) : null}
                      <form action={personalChatAction}>
                        <input
                          type="hidden"
                          name="roomId"
                          value={selected.id}
                        />
                        <input
                          type="hidden"
                          name="intent"
                          value={selected.archived ? "restore" : "archive"}
                        />
                        <button type="submit">
                          {selected.archived ? "Restaurar" : "Arquivar"}
                        </button>
                      </form>
                      {selected.kind === "direct" ? (
                        <form action={personalChatAction}>
                          <input
                            type="hidden"
                            name="roomId"
                            value={selected.id}
                          />
                          <input type="hidden" name="intent" value="close" />
                          <ConfirmSubmitButton
                            confirmation={tr(
                              "Fechar esta conversa só para você? A outra pessoa conserva o histórico.",
                              "Close this conversation only for you? The other person keeps the history.",
                            )}
                          >
                            <UiCopy pt="Fechar para mim" en="Close for me" />
                          </ConfirmSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </DismissibleDetails>
                  {params.avatar === "saved" ? (
                    <span role="status">
                      <UiCopy
                        pt="Imagem da conversa atualizada."
                        en="Conversation image updated."
                      />
                    </span>
                  ) : null}
                  {params.avatar === "error" ? (
                    <span role="alert">
                      <UiCopy
                        pt="Selecione uma imagem válida."
                        en="Select a valid image."
                      />
                    </span>
                  ) : null}
                </div>
              </div>
              <ChatRoom
                key={selected.id}
                roomId={selected.id}
                initialMessages={messages}
                roomUsers={roomUsers}
                currentUserId={user.id}
                wallpaper={wallpaper.preset}
                wallpaperVersion={wallpaper.updatedAt}
              />
            </>
          ) : (
            <div className="useful-empty">
              <strong>
                <UiCopy pt="Nenhuma conversa" en="No conversations" />
              </strong>
            </div>
          )}
        </main>
        {selected ? (
          <aside
            className="chat-context-panel"
            aria-label="Detalhes da conversa"
          >
            <ChatContextClose />
            <ChatParticipantPanel
              roomId={selected.id}
              participants={roomUsers}
            />
          </aside>
        ) : null}
      </ChatContextLayout>
    </div>
  );
}
