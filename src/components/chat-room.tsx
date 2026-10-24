"use client";
import { ChatAiControl, type ChatAiReply } from "@/components/chat-ai-control";
import { DismissibleDetails } from "@/components/dismissible-details";
import {
  chatFileLimitBytes,
  chatImageLimitBytes,
  isChatImageName,
  validChatFilename,
} from "@/lib/chat-upload";
import { UiCopy, useUiText } from "@/components/ui-language-provider";

import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import { createDirectChatAction } from "@/app/chat/actions";
import { sendRealtime, realtimeConnected } from "@/components/realtime-bridge";
import { pastedChatImage } from "@/lib/chat-clipboard";
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconQuote,
  IconPhoto,
  IconPaperclip,
  IconArrowDown,
  IconCornerDownLeft,
} from "@tabler/icons-react";

type Message = {
  id: number;
  authorUserId: number;
  authorName: string;
  bodySource: string;
  bodyHtml: string;
  replyBody: string | null;
  replyToMessageId?: number | null;
  replyAuthorName: string | null;
  replyAuthorUserId: number | null;
  editedAt: number | null;
  createdAt: number;
  attachmentIds: number[];
  attachments?: {
    id: number;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }[];
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
  canModerate = false,
}: {
  roomId: number;
  initialMessages: Message[];
  roomUsers: RoomUser[];
  currentUserId: number;
  wallpaper?: "plain" | "grid" | "dots" | "custom";
  wallpaperVersion?: number;
  canModerate?: boolean;
}) {
  const tr = useUiText();
  const [messages, setMessages] = useState(initialMessages);
  const [aiReplies, setAiReplies] = useState<ChatAiReply[]>([]);
  const [aiState, setAiState] = useState<{
    enabled: boolean;
    groupEnabled: boolean;
    permission: boolean;
    canConfigure: boolean;
  } | null>(null);
  const refreshAi = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai/room?room=${roomId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        setAiReplies([]);
        setAiState(null);
        return;
      }
      const data = await response.json();
      setAiReplies(data.messages);
      setAiState(data);
    } catch {
      /* Reconnect on the next visible poll. */
    }
  }, [roomId]);
  useEffect(() => {
    const initial = setTimeout(() => {
      void refreshAi();
    }, 0);
    const timer = setInterval(() => {
      if (!document.hidden) void refreshAi();
    }, 2000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refreshAi]);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(
    null,
  );
  const [editPending, setEditPending] = useState(false);
  const [reporting, setReporting] = useState<number | null>(null);
  const [reportStatus, setReportStatus] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [error, setError] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const [typingIds, setTypingIds] = useState<number[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionBindings, setMentionBindings] = useState<
    Array<{ id: number; label: string }>
  >([]);
  const historyMode = useRef(false);
  const revision = useRef<number | undefined>(undefined);
  const [hasOlder, setHasOlder] = useState(initialMessages.length >= 50);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [latestBusy, setLatestBusy] = useState(false);
  const lastId = useRef(initialMessages.at(-1)?.id ?? 0);
  const polling = useRef(false);
  const messageListRef = useRef<HTMLOListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stickToBottom = useRef(true);
  const userScrollIntent = useRef(false);
  const ownMessageScroll = useRef(false);
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
    const url =
      next && isChatImageName(next.name) ? URL.createObjectURL(next) : null;
    imagePreviewRef.current = url;
    setImage(next);
    setImagePreview(url);
  }

  function selectAttachment(next: File | null) {
    if (!next) {
      selectImage(null);
      return;
    }
    const limit = isChatImageName(next.name)
      ? chatImageLimitBytes
      : chatFileLimitBytes;
    if (!validChatFilename(next.name) || !next.size || next.size > limit) {
      setError(
        tr(
          "Use um arquivo de até 20 MiB; imagens PNG, JPEG e WebP de até 5 MiB.",
          "Use a file up to 20 MiB; PNG, JPEG and WebP images up to 5 MiB.",
        ),
      );
      return;
    }
    selectImage(next);
    setError("");
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
    if (!list || (!stickToBottom.current && !ownMessageScroll.current)) return;
    requestAnimationFrame(() => {
      const current = messageListRef.current;
      if (current) current.scrollTop = current.scrollHeight;
      ownMessageScroll.current = false;
    });
  }, [messages]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current && !historyMode.current)
        list.scrollTop = list.scrollHeight;
      setAwayFromBottom(
        historyMode.current ||
          list.scrollHeight - list.scrollTop - list.clientHeight > 80,
      );
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [roomId]);

  useEffect(() => {
    const poll = async () => {
      if (document.hidden || !navigator.onLine || polling.current) return;
      polling.current = true;
      try {
        const response = await fetch(
          `/api/chat/${roomId}?sync=1${revision.current === undefined ? "" : `&since=${revision.current}`}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          messages: Message[];
          removedIds: number[];
          revision: number;
          hasOlder: boolean;
        };
        if (revision.current === undefined) setHasOlder(payload.hasOlder);
        revision.current = payload.revision;
        if (!payload.messages.length && !payload.removedIds.length) return;
        if (
          !stickToBottom.current &&
          payload.messages.some((m) => m.id > lastId.current)
        )
          setNewMessages(true);
        lastId.current = Math.max(
          lastId.current,
          ...payload.messages.map(({ id }) => id),
        );
        setMessages((current) => {
          const byId = new Map(current.map((message) => [message.id, message]));
          for (const id of payload.removedIds) byId.delete(id);
          for (const message of payload.messages) {
            if (
              byId.has(message.id) ||
              (message.id >= (current[0]?.id ?? 0) &&
                (!historyMode.current || byId.size < 200))
            )
              byId.set(message.id, message);
          }
          for (const [id, message] of byId) {
            if (!message.replyToMessageId) continue;
            if (payload.removedIds.includes(message.replyToMessageId))
              byId.set(id, {
                ...message,
                replyBody: tr("Mensagem removida", "Message removed"),
              });
            else {
              const updated = payload.messages.find(
                (v) => v.id === message.replyToMessageId,
              );
              if (updated)
                byId.set(id, { ...message, replyBody: updated.bodySource });
            }
          }
          const values = [...byId.values()].sort((a, b) => a.id - b.id);
          return values.slice(-200);
        });
        if (stickToBottom.current)
          void fetch(`/api/chat/${roomId}/read`, { method: "POST" }).catch(
            () => undefined,
          );
      } catch {
        // The next poll/reconnect retries; unsent drafts remain in the composer.
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
    void poll();
    window.addEventListener("openstudyhub:realtime", onRealtime);
    const visibility = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", visibility);
    let lastFallback = Date.now();
    const interval = window.setInterval(() => {
      if (Date.now() - lastFallback >= (realtimeConnected() ? 30_000 : 5000)) {
        lastFallback = Date.now();
        void poll();
      }
    }, 5000);
    return () => {
      sendRealtime({ type: "unsubscribe", roomId });
      window.removeEventListener("openstudyhub:realtime", onRealtime);
      document.removeEventListener("visibilitychange", visibility);
      window.clearInterval(interval);
    };
  }, [currentUserId, roomId, tr]);

  useEffect(() => {
    const ids = roomUsers
      .filter(({ id }) => id !== currentUserId)
      .map(({ id }) => id);
    if (!ids.length) return;
    const refresh = async () => {
      if (document.hidden) return;
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
            form.set("file", image);
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
        if (image) {
          const failure = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          if (failure?.error === "attachment-storage-failed")
            pendingId.current = null;
        }
        setError(
          image
            ? tr(
                "Anexo não enviado. Verifique o arquivo e tente novamente.",
                "Attachment not sent. Check the file and try again.",
              )
            : tr("Mensagem não enviada.", "Message not sent."),
        );
        return;
      }
      const payload = (await response.json()) as {
        message: Message;
        attachmentWarning?: boolean;
        aiWarning?: string;
      };
      if (payload.aiWarning) setError(payload.aiWarning);
      if (payload.attachmentWarning) {
        setError(
          tr(
            "Mensagem enviada, mas o anexo não pôde ser armazenado.",
            "Message sent, but the attachment could not be stored.",
          ),
        );
      }
      pendingId.current = null;
      sendRealtime({ type: "refresh", roomId });
      ownMessageScroll.current = true;
      userScrollIntent.current = false;
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
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (sending) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length !== 1) {
          setError(
            tr("Envie um arquivo por mensagem.", "Send one file per message."),
          );
          return;
        }
        selectAttachment(files[0]);
      }}
    >
      {dragging ? (
        <div className="chat-drop-target">
          {tr(
            "Solte a imagem ou arquivo para anexar. Revise antes de enviar.",
            "Drop an image or file to attach. Review before sending.",
          )}
        </div>
      ) : null}
      {onlineIds.length || typingIds.length ? (
        <p className="chat-presence" aria-live="polite">
          {typingIds.length
            ? `${typingIds.length} pessoa(s) digitando…`
            : `${onlineIds.length} online agora`}
        </p>
      ) : null}
      {reportStatus ? <p role="status">{reportStatus}</p> : null}
      <ChatAiControl
        roomId={roomId}
        state={aiState}
        onChange={() => {
          void refreshAi();
        }}
      />
      <div className="chat-history-tools">
        {hasOlder ? (
          <button
            type="button"
            disabled={historyBusy}
            onClick={async () => {
              if (historyBusy || !messages.length) return;
              setHistoryBusy(true);
              const list = messageListRef.current,
                height = list?.scrollHeight ?? 0,
                top = list?.scrollTop ?? 0;
              stickToBottom.current = false;
              try {
                const response = await fetch(
                  `/api/chat/${roomId}?before=${messages[0].id}`,
                  { cache: "no-store" },
                );
                if (!response.ok) throw new Error();
                const data = (await response.json()) as {
                  messages: Message[];
                  hasOlder: boolean;
                };
                setMessages((current) =>
                  [
                    ...new Map(
                      [...data.messages, ...current].map((m) => [m.id, m]),
                    ).values(),
                  ]
                    .sort((a, b) => a.id - b.id)
                    .slice(0, 200),
                );
                setHasOlder(data.hasOlder);
                historyMode.current = true;
                setAwayFromBottom(true);
                requestAnimationFrame(() => {
                  if (list) list.scrollTop = top + list.scrollHeight - height;
                });
              } catch {
                setError(
                  tr(
                    "Não foi possível carregar o histórico. Tente novamente.",
                    "Could not load history. Try again.",
                  ),
                );
              } finally {
                setHistoryBusy(false);
              }
            }}
          >
            {historyBusy
              ? tr("Carregando…", "Loading…")
              : tr("↑ Mensagens anteriores", "↑ Earlier messages")}
          </button>
        ) : null}
      </div>
      <div className="chat-scroll-region">
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
          onWheel={() => {
            userScrollIntent.current = true;
          }}
          onTouchMove={() => {
            userScrollIntent.current = true;
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget)
              userScrollIntent.current = true;
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1 && event.target === event.currentTarget)
              userScrollIntent.current = true;
          }}
          onKeyDown={(event) => {
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "PageUp",
                "PageDown",
                "Home",
                "End",
                " ",
              ].includes(event.key)
            )
              userScrollIntent.current = true;
          }}
          onScroll={(event) => {
            const gap =
              event.currentTarget.scrollHeight -
              event.currentTarget.scrollTop -
              event.currentTarget.clientHeight;
            setAwayFromBottom(gap > 80 || historyMode.current);
            if (gap < 80 && !historyMode.current) setNewMessages(false);
            // Layout changes and image decoding must not be mistaken for a user leaving the tail.
            if (!userScrollIntent.current) return;
            userScrollIntent.current = false;
            const element = event.currentTarget;
            stickToBottom.current =
              element.scrollHeight - element.scrollTop - element.clientHeight <
              80;
          }}
        >
          {messages.map((message) => (
            <Fragment key={message.id}>
              <li
                key={message.id}
                data-own={message.authorUserId === currentUserId}
              >
                <header>
                  <DismissibleDetails className="chat-mini-profile">
                    <summary>
                      {roomUsers.find(({ id }) => id === message.authorUserId)
                        ?.hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/profile-media/${message.authorUserId}/avatar`}
                          alt=""
                        />
                      ) : (
                        <span
                          className="chat-avatar-fallback"
                          aria-hidden="true"
                        >
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
                              {profile.cohortName
                                ? ` · ${profile.cohortName}`
                                : ""}
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
                                <UiCopy
                                  pt="Enviar mensagem"
                                  en="Send message"
                                />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      );
                    })()}
                  </DismissibleDetails>
                  <time
                    dateTime={new Date(message.createdAt).toISOString()}
                    title={new Date(message.createdAt).toLocaleString("pt-BR")}
                  >
                    {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {message.editedAt ? (
                    <small>
                      <UiCopy pt="editada" en="edited" />
                    </small>
                  ) : null}
                </header>
                {message.replyBody ? (
                  <blockquote className="chat-message-quote">
                    {message.replyAuthorUserId ? (
                      roomUsers.find(
                        ({ id }) => id === message.replyAuthorUserId,
                      )?.hasAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/profile-media/${message.replyAuthorUserId}/avatar`}
                          alt=""
                        />
                      ) : (
                        <span
                          className="chat-avatar-fallback"
                          aria-hidden="true"
                        >
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
                {message.attachmentIds.map((attachmentId) => {
                  const attachment = message.attachments?.find(
                    (a) => a.id === attachmentId,
                  );
                  const isImage =
                    !attachment ||
                    ["image/png", "image/jpeg", "image/webp"].includes(
                      attachment.mimeType,
                    );
                  return isImage ? (
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
                        alt={
                          attachment?.name || tr("Imagem enviada", "Sent image")
                        }
                        loading="lazy"
                        onLoad={() => {
                          if (stickToBottom.current && messageListRef.current)
                            messageListRef.current.scrollTop =
                              messageListRef.current.scrollHeight;
                        }}
                      />
                    </a>
                  ) : (
                    <a
                      key={attachmentId}
                      className="chat-file-link"
                      href={`/api/chat-attachment/${attachmentId}`}
                      download={attachment.name}
                    >
                      <IconPaperclip size={24} aria-hidden="true" />
                      <span>
                        <strong>{attachment.name}</strong>
                        <small>
                          {(attachment.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                          {tr("Baixar arquivo", "Download file")}
                        </small>
                      </span>
                    </a>
                  );
                })}
                {editing?.id === message.id ? (
                  <form
                    className="chat-inline-edit"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!editing.body.trim() || editPending) return;
                      setEditPending(true);
                      setEditError("");
                      try {
                        const response = await fetch(`/api/chat/${roomId}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            messageId: editing.id,
                            body: editing.body,
                          }),
                        });
                        if (!response.ok) throw new Error();
                        const payload = (await response.json()) as {
                          message: Message;
                        };
                        setMessages((current) =>
                          current.map((item) =>
                            item.id === payload.message.id
                              ? payload.message
                              : item,
                          ),
                        );
                        setEditing(null);
                      } catch {
                        setEditError(
                          tr(
                            "Não foi possível salvar. Seu texto foi mantido.",
                            "Could not save. Your text was kept.",
                          ),
                        );
                      } finally {
                        setEditPending(false);
                      }
                    }}
                  >
                    <label>
                      {tr("Editar mensagem", "Edit message")}
                      <textarea
                        autoFocus
                        value={editing.body}
                        onChange={(event) =>
                          setEditing({ ...editing, body: event.target.value })
                        }
                        maxLength={10000}
                        required
                      />
                    </label>
                    {editError ? <p role="alert">{editError}</p> : null}
                    <button
                      type="button"
                      disabled={editPending}
                      onClick={() => setEditing(null)}
                    >
                      {tr("Cancelar", "Cancel")}
                    </button>
                    <button disabled={editPending || !editing.body.trim()}>
                      {editPending
                        ? tr("Salvando…", "Saving…")
                        : tr("Salvar alteração", "Save edit")}
                    </button>
                  </form>
                ) : null}
                {reporting === message.id ? (
                  <form
                    className="chat-inline-edit"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const reason = new FormData(e.currentTarget).get(
                        "reason",
                      );
                      try {
                        const response = await fetch(
                          `/api/chat/${roomId}/report`,
                          {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                              messageId: message.id,
                              reason,
                            }),
                          },
                        );
                        if (!response.ok) throw new Error();
                        setReportStatus(
                          tr("Denúncia enviada.", "Report sent."),
                        );
                        setReporting(null);
                      } catch {
                        setError(
                          tr(
                            "Não foi possível denunciar. Tente novamente.",
                            "Could not report. Try again.",
                          ),
                        );
                      }
                    }}
                  >
                    <p>
                      {tr(
                        "O Admin receberá o texto desta mensagem e seu motivo. As demais mensagens privadas não serão enviadas.",
                        "The Admin receives this message text and your reason. Other private messages are not sent.",
                      )}
                    </p>
                    <label>
                      {tr("Motivo da denúncia", "Report reason")}
                      <textarea
                        name="reason"
                        minLength={3}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <button>{tr("Enviar denúncia", "Send report")}</button>
                    <button type="button" onClick={() => setReporting(null)}>
                      {tr("Cancelar", "Cancel")}
                    </button>
                  </form>
                ) : null}
                <DismissibleDetails className="chat-actions-disclosure">
                  <summary
                    aria-label={tr("Ações da mensagem", "Message actions")}
                  >
                    ···
                  </summary>
                  <div className="chat-message-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
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
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                        setReporting(message.id);
                        setReportStatus("");
                      }}
                    >
                      {tr("Denunciar mensagem", "Report message")}
                    </button>
                    {canModerate && message.authorUserId !== currentUserId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (deleteConfirm !== message.id) {
                            setDeleteConfirm(message.id);
                            return;
                          }
                          try {
                            const response = await fetch(
                              `/api/chat/${roomId}`,
                              {
                                method: "DELETE",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ messageId: message.id }),
                              },
                            );
                            if (!response.ok) throw new Error();
                            setMessages((m) =>
                              m.filter((v) => v.id !== message.id),
                            );
                          } catch {
                            setError(
                              tr(
                                "Não foi possível moderar.",
                                "Could not moderate.",
                              ),
                            );
                          }
                        }}
                      >
                        {deleteConfirm === message.id
                          ? tr("Confirmar remoção", "Confirm removal")
                          : tr("Moderar: remover", "Moderate: remove")}
                      </button>
                    ) : null}
                    {message.authorUserId === currentUserId ? (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                            setEditing({
                              id: message.id,
                              body: message.bodySource,
                            });
                            setEditError("");
                          }}
                        >
                          <UiCopy pt="Editar" en="Edit" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (deleteConfirm !== message.id) {
                              setDeleteConfirm(message.id);
                              return;
                            }
                            const response = await fetch(
                              `/api/chat/${roomId}`,
                              {
                                method: "DELETE",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ messageId: message.id }),
                              },
                            );
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
                          {deleteConfirm === message.id
                            ? tr(
                                "Confirmar exclusão para todos",
                                "Confirm deletion for everyone",
                              )
                            : tr("Excluir para todos", "Delete for everyone")}
                        </button>
                      </>
                    ) : null}
                    {deleteConfirm === message.id ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        {tr("Cancelar exclusão", "Cancel deletion")}
                      </button>
                    ) : null}
                  </div>
                </DismissibleDetails>
              </li>
              {aiReplies
                .filter((reply) => reply.human_message_id === message.id)
                .map((reply) => (
                  <li key={reply.id} className="chat-ai-message">
                    <strong>✦ {tr("Assistente de IA", "AI assistant")}</strong>
                    <div>
                      {reply.content ||
                        tr("Preparando resposta…", "Preparing a reply…")}
                    </div>
                    {reply.status !== "complete" && (
                      <small>
                        {reply.status === "pending"
                          ? tr("Gerando…", "Generating…")
                          : tr(
                              "Resposta interrompida ou indisponível",
                              "Reply interrupted or unavailable",
                            )}
                      </small>
                    )}
                  </li>
                ))}
            </Fragment>
          ))}
        </ol>
        {awayFromBottom || newMessages ? (
          <button
            type="button"
            className="chat-latest-button"
            aria-label={tr("Ir para última mensagem", "Go to latest message")}
            title={tr("Ir para última mensagem", "Go to latest message")}
            disabled={latestBusy}
            onClick={async () => {
              if (latestBusy) return;
              if (!historyMode.current) {
                userScrollIntent.current = false;
                stickToBottom.current = true;
                const list = messageListRef.current;
                if (list) list.scrollTop = list.scrollHeight;
                setAwayFromBottom(false);
                setNewMessages(false);
                return;
              }
              setLatestBusy(true);
              try {
                const response = await fetch(`/api/chat/${roomId}?sync=1`, {
                  cache: "no-store",
                });
                if (!response.ok) throw new Error();
                const data = (await response.json()) as {
                  messages: Message[];
                  revision: number;
                  hasOlder: boolean;
                };
                userScrollIntent.current = false;
                stickToBottom.current = true;
                historyMode.current = false;
                ownMessageScroll.current = true;
                revision.current = data.revision;
                setMessages(data.messages);
                setHasOlder(data.hasOlder);
                setNewMessages(false);
                setAwayFromBottom(false);
              } catch {
                setError(
                  tr(
                    "Não foi possível atualizar. Tente novamente.",
                    "Could not refresh. Try again.",
                  ),
                );
              } finally {
                setLatestBusy(false);
              }
            }}
          >
            <IconArrowDown size={21} aria-hidden="true" />
            {newMessages ? (
              <span
                className="chat-latest-dot"
                aria-label={tr("Novas mensagens", "New messages")}
              />
            ) : null}
          </button>
        ) : null}
      </div>
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
        {image ? (
          <div className="chat-selected-file" role="status">
            {imagePreview ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt={tr("Prévia do anexo", "Attachment preview")}
                />
              </>
            ) : (
              <IconPaperclip size={22} aria-hidden="true" />
            )}
            <span>
              {image.name} · {(image.size / 1024).toFixed(1)} KB
            </span>
            <button
              type="button"
              aria-label={tr(
                "Remover anexo selecionado",
                "Remove selected attachment",
              )}
              onClick={() => {
                selectImage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              ×
            </button>
          </div>
        ) : null}
        <DismissibleDetails className="chat-compose-tools">
          <summary
            aria-label={tr("Formatação e anexos", "Formatting and attachments")}
            title={tr("Formatação e anexos", "Formatting and attachments")}
          >
            ＋
          </summary>
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
              title={tr("Anexar imagem ou arquivo", "Attach image or file")}
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={sending}
                aria-label={tr(
                  "Anexar imagem ou arquivo",
                  "Attach image or file",
                )}
                onChange={(event) =>
                  selectAttachment(event.target.files?.[0] ?? null)
                }
              />
              <span>
                <IconPhoto size={19} stroke={1.8} aria-hidden="true" />
                {tr("Imagem ou arquivo", "Image or file")}
              </span>
            </label>
            <span className="chat-format-help">
              <UiCopy
                pt="Enter envia · Shift+Enter quebra linha · @ menciona"
                en="Enter sends · Shift+Enter adds a line · @ mentions"
              />
            </span>
          </div>
        </DismissibleDetails>
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
              rows={1}
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
            {sending ? (
              "…"
            ) : (
              <IconCornerDownLeft size={22} stroke={2} aria-hidden="true" />
            )}
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
