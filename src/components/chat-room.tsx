"use client";

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createDirectChatAction } from "@/app/chat/actions";

type Message = {
  id: number;
  authorUserId: number;
  authorName: string;
  bodyHtml: string;
  replyBody: string | null;
  editedAt: number | null;
  createdAt: number;
  attachmentIds: number[];
};

type RoomUser = {
  id: number;
  displayName: string;
  bio: string;
  hasAvatar: boolean;
  programName: string | null;
  cohortName: string | null;
  tags: string[];
};

type FormatToken = "bold" | "italic" | "strike" | "code" | "quote";

export function ChatRoom({
  roomId,
  initialMessages,
  roomUsers,
  currentUserId,
}: {
  roomId: number;
  initialMessages: Message[];
  roomUsers: RoomUser[];
  currentUserId: number;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionBindings, setMentionBindings] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0);
  const polling = useRef(false);
  const messageListRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stickToBottom = useRef(true);

  const mentionMatch = /(?:^|\s)@([^\s@]*)$/u.exec(body);
  const mentionQuery = mentionMatch?.[1]?.toLocaleLowerCase("pt-BR") ?? null;
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    return roomUsers
      .filter(({ id }) => id !== currentUserId)
      .filter(({ displayName }) =>
        displayName.toLocaleLowerCase("pt-BR").includes(mentionQuery),
      )
      .slice(0, 6);
  }, [currentUserId, mentionQuery, roomUsers]);
  const selectedMentionIndex = mentionCandidates.length
    ? mentionIndex % mentionCandidates.length
    : 0;

  useEffect(() => {
    const list = messageListRef.current;
    if (!list || !stickToBottom.current) return;
    requestAnimationFrame(() => {
      const current = messageListRef.current;
      if (current) current.scrollTop = current.scrollHeight;
    });
  }, [messages]);

  useEffect(() => {
    const poll = async () => {
      if (document.hidden || polling.current) return;
      polling.current = true;
      try {
        const response = await fetch(
          `/api/chat/${roomId}?after=${lastId.current}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { messages: Message[] };
        if (!payload.messages.length) return;
        lastId.current = Math.max(
          lastId.current,
          ...payload.messages.map(({ id }) => id),
        );
        setMessages((current) => {
          const byId = new Map(current.map((message) => [message.id, message]));
          for (const message of payload.messages) byId.set(message.id, message);
          return [...byId.values()].sort((a, b) => a.id - b.id);
        });
      } finally {
        polling.current = false;
      }
    };
    const visibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(poll, 5000);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
    };
  }, [roomId]);

  function applyFormat(token: FormatToken) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const pair =
      token === "bold"
        ? ["**", "**"]
        : token === "italic"
          ? ["*", "*"]
          : token === "strike"
            ? ["~~", "~~"]
            : token === "code"
              ? ["`", "`"]
              : ["> ", ""];
    const fallback = "texto";
    const nextValue = `${body.slice(0, start)}${pair[0]}${selected || fallback}${pair[1]}${body.slice(end)}`;
    setBody(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + pair[0].length;
      const selectionEnd = selectionStart + (selected || fallback).length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertMention(candidate: RoomUser) {
    const match = /(?:^|\s)@([^\s@]*)$/u.exec(body);
    if (!match) return;
    const tokenStart = match.index + (match[0].startsWith(" ") ? 1 : 0);
    const replacement = `@${candidate.displayName} `;
    const next = `${body.slice(0, tokenStart)}${replacement}`;
    setBody(next);
    setMentionBindings((current) => [
      ...current.filter(({ id }) => id !== candidate.id),
      { id: candidate.id, label: candidate.displayName },
    ]);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(next.length, next.length);
    });
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending || (!body.trim() && !image)) return;
    setSending(true);
    setError("");
    try {
      let wireBody = body;
      for (const mention of mentionBindings) {
        wireBody = wireBody.replaceAll(
          `@${mention.label}`,
          `@[${mention.label}](user:${mention.id})`,
        );
      }
      const response = image
        ? await (() => {
            const form = new FormData();
            form.set("body", wireBody);
            form.set("replyToMessageId", replyTo ? String(replyTo.id) : "");
            form.set("image", image);
            return fetch(`/api/chat/${roomId}`, { method: "POST", body: form });
          })()
        : await fetch(`/api/chat/${roomId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              body: wireBody,
              hasAttachment: false,
              replyToMessageId: replyTo?.id ?? null,
            }),
          });
      if (!response.ok) {
        setError(
          image
            ? "Imagem não enviada. Verifique o arquivo e tente novamente."
            : "Mensagem não enviada.",
        );
        return;
      }
      const payload = (await response.json()) as {
        message: Message;
        attachmentWarning?: boolean;
      };
      if (payload.attachmentWarning) {
        setError("Mensagem enviada, mas a imagem não pôde ser armazenada.");
      }
      stickToBottom.current = true;
      lastId.current = Math.max(lastId.current, payload.message.id);
      setMessages((current) => {
        const found = current.some(({ id }) => id === payload.message.id);
        return found
          ? current.map((message) =>
              message.id === payload.message.id ? payload.message : message,
            )
          : [...current, payload.message];
      });
      setBody("");
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setReplyTo(null);
      setMentionBindings([]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (mentionCandidates.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) => (current + 1) % mentionCandidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (current) =>
            (current - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }
      if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
        event.preventDefault();
        insertMention(
          mentionCandidates[selectedMentionIndex] ?? mentionCandidates[0],
        );
        return;
      }
      if (event.key === "Escape") {
        setBody((current) => current.replace(/@([^\s@]*)$/u, "$1"));
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <section className="chat-room" aria-label="Mensagens">
      <ol
        ref={messageListRef}
        className="chat-message-list"
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
      >
        {messages.map((message) => (
          <li key={message.id}>
            <header>
              <details className="chat-mini-profile">
                <summary>
                  {roomUsers.find(({ id }) => id === message.authorUserId)
                    ?.hasAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/profile-media/${message.authorUserId}/avatar`}
                      alt=""
                    />
                  ) : (
                    <span className="chat-avatar-fallback" aria-hidden="true">
                      {message.authorName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {message.authorName}
                </summary>
                {(() => {
                  const profile = roomUsers.find(
                    ({ id }) => id === message.authorUserId,
                  );
                  if (!profile) return null;
                  return (
                    <div>
                      {profile.programName ? (
                        <span>
                          {profile.programName}
                          {profile.cohortName ? ` · ${profile.cohortName}` : ""}
                        </span>
                      ) : null}
                      {profile.bio ? <p>{profile.bio}</p> : null}
                      {profile.tags.length ? (
                        <span>{profile.tags.join(" · ")}</span>
                      ) : null}
                      <a href={`/profile/${profile.id}`}>Ver perfil</a>
                      {profile.id !== currentUserId ? (
                        <form action={createDirectChatAction}>
                          <input
                            type="hidden"
                            name="targetUserId"
                            value={profile.id}
                          />
                          <button type="submit">Enviar mensagem</button>
                        </form>
                      ) : null}
                    </div>
                  );
                })()}
              </details>
              <time>{new Date(message.createdAt).toLocaleString("pt-BR")}</time>
              {message.editedAt ? <small>editada</small> : null}
            </header>
            {message.replyBody ? (
              <blockquote>{message.replyBody.slice(0, 180)}</blockquote>
            ) : null}
            {message.bodyHtml ? (
              <div
                className="chat-message-body"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            ) : null}
            {message.attachmentIds.map((attachmentId) => (
              <a
                key={attachmentId}
                className="chat-attachment-link"
                href={`/api/chat-attachment/${attachmentId}`}
                target="_blank"
                rel="noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="chat-attachment"
                  src={`/api/chat-attachment/${attachmentId}`}
                  alt="Anexo da mensagem"
                  onLoad={() => {
                    if (!stickToBottom.current) return;
                    const list = messageListRef.current;
                    if (list) list.scrollTop = list.scrollHeight;
                  }}
                />
              </a>
            ))}
            <div className="chat-message-actions">
              <button type="button" onClick={() => setReplyTo(message)}>
                Responder
              </button>
              {message.authorUserId === currentUserId ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = window.prompt("Editar mensagem");
                      if (!next?.trim()) return;
                      const response = await fetch(`/api/chat/${roomId}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                          messageId: message.id,
                          body: next,
                        }),
                      });
                      if (!response.ok) return;
                      const payload = (await response.json()) as {
                        message: Message;
                      };
                      setMessages((current) =>
                        current.map((candidate) =>
                          candidate.id === payload.message.id
                            ? payload.message
                            : candidate,
                        ),
                      );
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const response = await fetch(`/api/chat/${roomId}`, {
                        method: "DELETE",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ messageId: message.id }),
                      });
                      if (response.ok) {
                        setMessages((current) =>
                          current.filter(({ id }) => id !== message.id),
                        );
                      }
                    }}
                  >
                    Excluir
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <form ref={formRef} className="chat-composer" onSubmit={send}>
        {replyTo ? (
          <div className="chat-reply-preview">
            <span>
              Respondendo a <strong>{replyTo.authorName}</strong>
            </span>
            <button type="button" onClick={() => setReplyTo(null)}>
              Cancelar
            </button>
          </div>
        ) : null}
        <div
          className="chat-format-toolbar"
          aria-label="Formatação da mensagem"
        >
          <button
            type="button"
            title="Negrito"
            aria-label="Negrito"
            onClick={() => applyFormat("bold")}
          >
            B
          </button>
          <button
            type="button"
            title="Itálico"
            aria-label="Itálico"
            onClick={() => applyFormat("italic")}
          >
            I
          </button>
          <button
            type="button"
            title="Riscado"
            aria-label="Riscado"
            onClick={() => applyFormat("strike")}
          >
            S
          </button>
          <button
            type="button"
            title="Código inline"
            aria-label="Código inline"
            onClick={() => applyFormat("code")}
          >
            &lt;/&gt;
          </button>
          <button
            type="button"
            title="Citação"
            aria-label="Citação"
            onClick={() => applyFormat("quote")}
          >
            &gt;
          </button>
          <label className="chat-toolbar-attachment" title="Adicionar imagem">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                if (next && next.size > 5 * 1024 * 1024) {
                  setImage(null);
                  event.target.value = "";
                  setError("A imagem deve ter no máximo 5 MiB.");
                  return;
                }
                setError("");
                setImage(next);
              }}
            />
            <span>{image ? `IMG · ${image.name}` : "IMG"}</span>
          </label>
          {image ? (
            <button
              type="button"
              className="chat-clear-attachment"
              onClick={() => {
                setImage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label="Remover imagem selecionada"
              title="Remover imagem selecionada"
            >
              ×
            </button>
          ) : null}
          <span className="chat-format-help">
            Enter envia · Shift+Enter quebra linha · @ menciona
          </span>
        </div>
        <div className="chat-composer-main">
          <label className="chat-message-field">
            <span className="sr-only">Mensagem</span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              maxLength={10_000}
              rows={2}
              placeholder="Mensagem…"
            />
          </label>
          <button
            className="chat-send-button"
            type="submit"
            disabled={sending || (!body.trim() && !image)}
            aria-label="Enviar mensagem"
            title="Enviar (Enter)"
          >
            {sending ? "…" : "↵"}
          </button>
          {mentionCandidates.length ? (
            <div
              className="chat-mention-menu"
              role="listbox"
              aria-label="Mencionar usuário"
            >
              {mentionCandidates.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-selected={index === selectedMentionIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(candidate)}
                >
                  @{candidate.displayName}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {error ? <span role="alert">{error}</span> : null}
      </form>
    </section>
  );
}
