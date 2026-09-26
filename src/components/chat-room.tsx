"use client";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { createDirectChatAction } from "@/app/chat/actions";
import { sendRealtime } from "@/components/realtime-bridge";
import { pastedChatImage } from "@/lib/chat-clipboard";
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconQuote,
  IconPhoto,
} from "@tabler/icons-react";

type Message = {
  id: number;
  authorUserId: number;
  authorName: string;
  bodySource: string;
  bodyHtml: string;
  replyBody: string | null;
  replyAuthorName: string | null;
  replyAuthorUserId: number | null;
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
  wallpaper = "plain",
  wallpaperVersion = 0,
}: {
  roomId: number;
  initialMessages: Message[];
  roomUsers: RoomUser[];
  currentUserId: number;
  wallpaper?: "plain" | "grid" | "dots" | "custom";
  wallpaperVersion?: number;
}) {
  const tr = useUiText();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const [typingIds, setTypingIds] = useState<number[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionBindings, setMentionBindings] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0);
  const polling = useRef(false);
  const messageListRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stickToBottom = useRef(true);
  const pendingId = useRef<string | null>(null);
  const lastTypingAt = useRef(0);

  useEffect(
    () => () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    },
    [],
  );

  function selectImage(next: File | null) {
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    imagePreviewRef.current = url;
    setImage(next);
    setImagePreview(url);
  }

  function pasteImage(event: ClipboardEvent<HTMLTextAreaElement>) {
    const { file, hasText, invalidImage } = pastedChatImage(
      Array.from(event.clipboardData.items),
    );
    if (invalidImage) {
      setError(
        tr(
          "Use PNG, JPEG ou WebP de até 5 MiB.",
          "Use PNG, JPEG or WebP up to 5 MiB.",
        ),
      );
      return;
    }
    if (!file) return;
    if (!hasText) event.preventDefault();
    const extension =
      file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    selectImage(
      new File([file], file.name || `imagem-colada.${extension}`, {
        type: file.type,
      }),
    );
    setError("");
  }

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
        void fetch(`/api/chat/${roomId}/read`, { method: "POST" }).catch(
          () => undefined,
        );
      } finally {
        polling.current = false;
      }
    };
    const read = async () => {
      await fetch(`/api/chat/${roomId}/read`, { method: "POST" }).catch(
        () => undefined,
      );
    };
    const onRealtime = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          type: string;
          roomId?: number;
          userId?: number;
          active?: boolean;
        }>
      ).detail;
      if (detail.type === "ready") {
        sendRealtime({ type: "subscribe", roomId });
        void poll();
      }
      if (detail.type === "message" && detail.roomId === roomId) void poll();
      if (
        detail.type === "typing" &&
        detail.roomId === roomId &&
        detail.userId !== currentUserId &&
        detail.userId
      ) {
        setTypingIds((current) =>
          detail.active
            ? [...new Set([...current, detail.userId!])]
            : current.filter((id) => id !== detail.userId),
        );
        window.setTimeout(
          () =>
            setTypingIds((current) =>
              current.filter((id) => id !== detail.userId),
            ),
          4000,
        );
      }
    };
    sendRealtime({ type: "subscribe", roomId });
    void read();
    window.addEventListener("openstudyhub:realtime", onRealtime);
    const visibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    const interval = window.setInterval(poll, 5000);
    return () => {
      sendRealtime({ type: "unsubscribe", roomId });
      window.removeEventListener("openstudyhub:realtime", onRealtime);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
    };
  }, [currentUserId, roomId]);

  useEffect(() => {
    const ids = roomUsers
      .filter(({ id }) => id !== currentUserId)
      .map(({ id }) => id);
    if (!ids.length) return;
    const refresh = async () => {
      const response = await fetch(`/api/presence?ids=${ids.join(",")}`, {
        cache: "no-store",
      });
      if (response.ok)
        setOnlineIds(
          (
            (await response.json()) as {
              users: Array<{ id: number; online: boolean }>;
            }
          ).users
            .filter(({ online }) => online)
            .map(({ id }) => id),
        );
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [currentUserId, roomUsers]);

  useEffect(() => {
    const now = Date.now();
    if (body.trim() && now - lastTypingAt.current > 2000) {
      lastTypingAt.current = now;
      sendRealtime({ type: "typing", roomId, active: true });
    }
    const timer = window.setTimeout(
      () => sendRealtime({ type: "typing", roomId, active: false }),
      1600,
    );
    return () => window.clearTimeout(timer);
  }, [body, roomId]);

  function applyFormat(token: FormatToken) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    if (token === "quote") {
      const lineStart = body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const lineEndIndex = body.indexOf("\n", end);
      const lineEnd = lineEndIndex < 0 ? body.length : lineEndIndex;
      const block = body.slice(lineStart, lineEnd);
      if (!block.trim()) {
        textarea.focus();
        return;
      }
      const quoted = block
        .split("\n")
        .map((line) => (line.startsWith("> ") ? line.slice(2) : `> ${line}`))
        .join("\n");
      const next = `${body.slice(0, lineStart)}${quoted}${body.slice(lineEnd)}`;
      setBody(next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(
          lineStart + quoted.length,
          lineStart + quoted.length,
        );
      });
      return;
    }
    const pair =
      token === "bold"
        ? ["**", "**"]
        : token === "italic"
          ? ["*", "*"]
          : token === "strike"
            ? ["~~", "~~"]
            : ["`", "`"];
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
      pendingId.current ??= crypto.randomUUID();
      let wireBody = body;
      if (replyTo.length > 1) {
        const quotes = replyTo.map(
          (message) =>
            `> ${message.authorName}: ${message.bodySource.replaceAll(/\s+/gu, " ").slice(0, 160) || "Imagem"}`,
        );
        wireBody = `${quotes.join("\n")}\n\n${wireBody}`;
      }
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
            form.set(
              "replyToMessageId",
              replyTo.length === 1 ? String(replyTo[0].id) : "",
            );
            form.set("image", image);
            form.set("clientMessageId", pendingId.current!);
            return fetch(`/api/chat/${roomId}`, { method: "POST", body: form });
          })()
        : await fetch(`/api/chat/${roomId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              body: wireBody,
              clientMessageId: pendingId.current,
              replyToMessageId: replyTo.length === 1 ? replyTo[0].id : null,
            }),
          });
      if (!response.ok) {
        setError(
          image
            ? tr(
                "Imagem não enviada. Verifique o arquivo e tente novamente.",
                "Image not sent. Check the file and try again.",
              )
            : tr("Mensagem não enviada.", "Message not sent."),
        );
        return;
      }
      const payload = (await response.json()) as {
        message: Message;
        attachmentWarning?: boolean;
      };
      if (payload.attachmentWarning) {
        setError(
          tr(
            "Mensagem enviada, mas a imagem não pôde ser armazenada.",
            "Message sent, but the image could not be stored.",
          ),
        );
      }
      pendingId.current = null;
      sendRealtime({ type: "refresh", roomId });
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
      selectImage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setReplyTo([]);
      setMentionBindings([]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      setError(
        tr(
          "Mensagem não enviada. Tente novamente.",
          "Message not sent. Try again.",
        ),
      );
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
    <section
      className="chat-room"
      aria-label={tr("Mensagens", "Messages")}
      data-wallpaper={wallpaper}
    >
      {onlineIds.length || typingIds.length ? (
        <p className="chat-presence" aria-live="polite">
          {typingIds.length
            ? `${typingIds.length} pessoa(s) digitando…`
            : `${onlineIds.length} online agora`}
        </p>
      ) : null}
      <ol
        ref={messageListRef}
        className="chat-message-list"
        style={
          wallpaper === "custom"
            ? {
                backgroundImage: `url(/api/chat-wallpaper?v=${wallpaperVersion})`,
              }
            : undefined
        }
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
      >
        {messages.map((message) => (
          <li
            key={message.id}
            data-own={message.authorUserId === currentUserId}
          >
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
                      <a href={`/profile/${profile.id}`}>
                        <UiCopy pt="Ver perfil" en="View profile" />
                      </a>
                      {profile.id !== currentUserId ? (
                        <form action={createDirectChatAction}>
                          <input
                            type="hidden"
                            name="targetUserId"
                            value={profile.id}
                          />
                          <button type="submit">
                            <UiCopy pt="Enviar mensagem" en="Send message" />
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })()}
              </details>
              <time>{new Date(message.createdAt).toLocaleString("pt-BR")}</time>
              {message.editedAt ? (
                <small>
                  <UiCopy pt="editada" en="edited" />
                </small>
              ) : null}
            </header>
            {message.replyBody ? (
              <blockquote className="chat-message-quote">
                {message.replyAuthorUserId ? (
                  roomUsers.find(({ id }) => id === message.replyAuthorUserId)
                    ?.hasAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/profile-media/${message.replyAuthorUserId}/avatar`}
                      alt=""
                    />
                  ) : (
                    <span className="chat-avatar-fallback" aria-hidden="true">
                      {message.replyAuthorName?.slice(0, 1).toUpperCase() ??
                        "?"}
                    </span>
                  )
                ) : null}
                {message.replyAuthorName ? (
                  <strong>{message.replyAuthorName}</strong>
                ) : null}
                <span>{message.replyBody.slice(0, 180)}</span>
              </blockquote>
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
              <button
                type="button"
                onClick={() => {
                  setReplyTo((current) =>
                    current.some(({ id }) => id === message.id)
                      ? current
                      : [...current, message].slice(0, 5),
                  );
                  textareaRef.current?.focus();
                }}
              >
                <UiCopy pt="Responder" en="Reply" />
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
                    <UiCopy pt="Editar" en="Edit" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Excluir esta mensagem para todos nesta conversa?",
                        )
                      )
                        return;
                      const response = await fetch(`/api/chat/${roomId}`, {
                        method: "DELETE",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ messageId: message.id }),
                      });
                      if (response.ok) {
                        setMessages((current) =>
                          current.filter(({ id }) => id !== message.id),
                        );
                      } else
                        setError(
                          tr(
                            "Não foi possível excluir a mensagem.",
                            "Could not delete message.",
                          ),
                        );
                    }}
                  >
                    <UiCopy pt="Excluir para todos" en="Delete for everyone" />
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <form ref={formRef} className="chat-composer" onSubmit={send}>
        {replyTo.length ? (
          <div
            className="chat-reply-preview"
            aria-label={tr("Mensagens citadas", "Quoted messages")}
          >
            <div className="chat-reply-selection">
              {replyTo.map((message) => (
                <div className="chat-reply-item" key={message.id}>
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
                  <span>
                    <strong>{message.authorName}</strong>
                    <small>
                      {message.bodySource
                        .replaceAll(/\s+/gu, " ")
                        .slice(0, 80) || "Imagem"}
                    </small>
                  </span>
                  <button
                    type="button"
                    aria-label={tr(
                      `Remover citação de ${message.authorName}`,
                      `Remove quote from ${message.authorName}`,
                    )}
                    onClick={() =>
                      setReplyTo((current) =>
                        current.filter(({ id }) => id !== message.id),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setReplyTo([])}>
              <UiCopy pt="Cancelar respostas" en="Cancel replies" />
            </button>
          </div>
        ) : null}
        <div
          className="chat-format-toolbar"
          aria-label={tr("Formatação da mensagem", "Message formatting")}
        >
          <button
            type="button"
            title={tr("Negrito", "Bold")}
            aria-label={tr("Negrito", "Bold")}
            onClick={() => applyFormat("bold")}
          >
            <IconBold size={19} stroke={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={tr("Itálico", "Italic")}
            aria-label={tr("Itálico", "Italic")}
            onClick={() => applyFormat("italic")}
          >
            <IconItalic size={19} stroke={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={tr("Riscado", "Strikethrough")}
            aria-label={tr("Riscado", "Strikethrough")}
            onClick={() => applyFormat("strike")}
          >
            <IconStrikethrough size={19} stroke={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={tr("Código inline", "Inline code")}
            aria-label={tr("Código inline", "Inline code")}
            onClick={() => applyFormat("code")}
          >
            <IconCode size={19} stroke={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={tr("Citação", "Quote")}
            aria-label={tr("Citação", "Quote")}
            onClick={() => applyFormat("quote")}
          >
            <IconQuote size={19} stroke={1.8} aria-hidden="true" />
          </button>
          <label
            className="chat-toolbar-attachment"
            title={tr("Adicionar imagem", "Add image")}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                if (next && next.size > 5 * 1024 * 1024) {
                  selectImage(null);
                  event.target.value = "";
                  setError(
                    tr(
                      "A imagem deve ter no máximo 5 MiB.",
                      "Image must be at most 5 MiB.",
                    ),
                  );
                  return;
                }
                setError("");
                selectImage(next);
              }}
            />
            <span>
              <IconPhoto size={19} stroke={1.8} aria-hidden="true" />
              {image ? image.name : "Imagem"}
            </span>
          </label>
          {image ? (
            <div className="chat-paste-preview" role="status">
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt={tr(
                      "Prévia da imagem selecionada",
                      "Preview of selected image",
                    )}
                  />
                </>
              ) : null}
              <span>
                {image.name}
                <UiCopy
                  pt="· será enviada com a mensagem"
                  en="· will be sent with the message"
                />
              </span>
            </div>
          ) : null}
          {image ? (
            <button
              type="button"
              className="chat-clear-attachment"
              onClick={() => {
                selectImage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              aria-label={tr(
                "Remover imagem selecionada",
                "Remove selected image",
              )}
              title={tr("Remover imagem selecionada", "Remove selected image")}
            >
              ×
            </button>
          ) : null}
          <span className="chat-format-help">
            <UiCopy
              pt="Enter envia · Shift+Enter quebra linha · @ menciona"
              en="Enter sends · Shift+Enter adds a line · @ mentions"
            />
          </span>
        </div>
        <div className="chat-composer-main">
          <label className="chat-message-field">
            <span className="sr-only">
              <UiCopy pt="Mensagem" en="Message" />
            </span>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(event) => {
                const field = event.currentTarget;
                setBody(field.value);
                field.style.height = "auto";
                field.style.height = `${Math.min(field.scrollHeight, 144)}px`;
              }}
              onKeyDown={handleComposerKeyDown}
              onPaste={pasteImage}
              maxLength={10_000}
              rows={2}
              placeholder={tr("Mensagem…", "Message…")}
            />
          </label>
          <button
            className="chat-send-button"
            type="submit"
            disabled={sending || (!body.trim() && !image)}
            aria-label={tr("Enviar mensagem", "Send message")}
            title={tr("Enviar (Enter)", "Send (Enter)")}
          >
            {sending ? "…" : "↵"}
          </button>
          {mentionCandidates.length ? (
            <div
              className="chat-mention-menu"
              role="listbox"
              aria-label={tr("Mencionar usuário", "Mention user")}
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
