"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { DismissibleDetails } from "@/components/dismissible-details";
import {
  IconMessagePlus,
  IconSearch,
  IconSend,
  IconPlayerStop,
  IconPaperclip,
  IconFileText,
  IconRobot,
  IconX,
} from "@tabler/icons-react";
import { useUiText } from "@/components/ui-language-provider";
import type { AiConversation, AiMessage } from "@/lib/ai/conversations";
import type { SourceChoice } from "@/lib/ai/sources";
type Source = {
  id: string;
  label: string;
  title: string;
  attachment: boolean;
  messageId: string;
};
export function AiWorkspace() {
  const t = useUiText();
  const [conversations, setConversations] = useState<AiConversation[]>([]),
    [id, setId] = useState<string | null>(null),
    [conversation, setConversation] = useState<AiConversation | null>(null),
    [messages, setMessages] = useState<AiMessage[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [groups, setGroups] = useState<{ id: number; name: string }[]>([]),
    [group, setGroup] = useState(""),
    [enabled, setEnabled] = useState(false),
    [allowGroups, setAllowGroups] = useState(false),
    [allowFiles, setAllowFiles] = useState(false),
    [allowSources, setAllowSources] = useState(false),
    [vision, setVision] = useState(false),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(""),
    [files, setFiles] = useState<File[]>([]),
    [choices, setChoices] = useState<SourceChoice[]>([]),
    [selected, setSelected] = useState<number[]>([]),
    [sourcePicker, setSourcePicker] = useState(false),
    [active, setActive] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [panel, setPanel] = useState<"rename" | "delete" | "share" | null>(null),
    [title, setTitle] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const selectedId = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    stick = useRef(true);
  function openConversation(next: string | null) {
    selectedId.current = next;
    setPanel(null);
    setConfirmed(false);
    setError("");
    setMessages([]);
    setSources([]);
    setActive(null);
    setConversation(null);
    setId(next);
  }
  async function api(path: string, body?: unknown) {
    const response = await fetch(
      `/api/ai/${path}`,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data;
  }
  const refresh = useCallback(async () => {
    try {
      const data = await fetch(
        `/api/ai/conversations?q=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      ).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      setConversations(data.conversations);
      setGroups(data.groups);
      setEnabled(data.enabled);
      setAllowGroups(data.allowGroups);
      setAllowFiles(data.attachments);
      setAllowSources(data.sources);
      setVision(data.vision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [query]);
  const load = useCallback(async (current: string) => {
    const response = await fetch(
      `/api/ai/conversations?id=${encodeURIComponent(current)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (selectedId.current !== current) return;
    setConversation(data.conversation);
    setTitle(data.conversation.title);
    setMessages(data.messages);
    setSources(data.sources);
    setActive(data.active?.id ?? null);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh();
    }, 200);
    return () => clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (id) void load(id).catch((e) => setError(e.message));
  }, [id, load]);
  useEffect(() => {
    if (!active) return;
    const stream = new EventSource(
      `/api/ai/stream?request=${encodeURIComponent(active)}`,
    );
    stream.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) setError(data.error);
      setMessages((current) =>
        current.map((m) =>
          m.id === data.id
            ? {
                ...m,
                content: data.content,
                status: ["queued", "running"].includes(data.status)
                  ? "pending"
                  : data.status,
              }
            : m,
        ),
      );
      if (!["queued", "running"].includes(data.status)) {
        stream.close();
        setActive(null);
        if (id) void load(id).catch((e) => setError(e.message));
        void refresh();
      }
    };
    stream.onerror = () => {
      stream.close();
      setActive(null);
      setNotice(
        t(
          "Conexão interrompida. Reabra a conversa para conferir a resposta.",
          "Connection interrupted. Reopen the conversation to check the response.",
        ),
      );
    };
    return () => stream.close();
  }, [active, id, load, refresh, t]);
  useEffect(() => {
    if (stick.current && listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);
  async function create() {
    setBusy(true);
    try {
      const data = await api("conversations", { action: "create" });
      openConversation(data.conversation.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  function addFiles(next: File[]) {
    if (
      files.length + next.length > 4 ||
      next.some((f) => f.size > 10 * 1024 * 1024)
    ) {
      setError(
        t(
          "Até quatro arquivos, com 10 MB cada.",
          "Up to four files, 10 MB each.",
        ),
      );
      return;
    }
    if (!vision && next.some((f) => /\.(png|jpe?g|webp)$/i.test(f.name))) {
      setError(
        t(
          "O modelo configurado não aceita imagens.",
          "The configured model does not support images.",
        ),
      );
      return;
    }
    setFiles((current) => [...current, ...next]);
  }
  async function send() {
    if (!id || !draft.trim() || busy || active) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData();
      form.set("conversation", id);
      form.set("content", draft);
      form.set(
        "sources",
        JSON.stringify(
          selected
            .map((i) => choices[i])
            .filter(Boolean)
            .map(({ kind, id, path }) => ({ kind, id, path })),
        ),
      );
      for (const file of files) form.append("file", file);
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDraft("");
      setFiles([]);
      setSelected([]);
      setSourcePicker(false);
      stick.current = true;
      await load(id);
      setActive(result.requestId);
      if (result.truncated)
        setNotice(
          t(
            "O contexto foi reduzido para respeitar os limites.",
            "Context was reduced to respect limits.",
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function action(name: string) {
    if (!id) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("conversations", {
        action: name,
        id,
        title,
        groupId: Number(group),
        confirmed,
      });
      setPanel(null);
      setConfirmed(false);
      if (name === "delete") {
        openConversation(null);
        setConversation(null);
        setMessages([]);
      } else if (name === "share") openConversation(result.conversation.id);
      else await load(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="ai-workspace"
      aria-label={t("Assistente de IA", "AI assistant")}
    >
      <aside className="ai-sidebar">
        <header>
          <IconRobot size={25} />
          <h1>{t("Assistente de IA", "AI assistant")}</h1>
        </header>
        <button onClick={() => void create()} disabled={!enabled || busy}>
          <IconMessagePlus size={18} />
          {t("Nova conversa", "New conversation")}
        </button>
        <label className="ai-search">
          <IconSearch size={16} />
          <input
            aria-label={t("Buscar conversas", "Search conversations")}
            placeholder={t("Buscar no histórico…", "Search history…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
          />
        </label>
        <nav aria-label={t("Conversas", "Conversations")}>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={c.id === id ? "active" : ""}
              onClick={() => openConversation(c.id)}
            >
              <strong>{c.title}</strong>
              <small>
                {c.group_id ? t("Grupo", "Group") : t("Privada", "Private")}
              </small>
            </button>
          ))}
        </nav>
        <p>
          {t(
            "A IA pode errar. Confira as fontes e as respostas.",
            "AI can make mistakes. Check sources and answers.",
          )}
        </p>
        <Link href="/chat">{t("Conversas do Hub", "Hub conversations")} →</Link>
      </aside>
      <div className="ai-main">
        <header className="ai-conversation-header">
          <div>
            <h2>
              {conversation?.title ??
                t("Seu espaço de estudo com IA", "Your AI study space")}
            </h2>
            <small>
              {conversation?.group_id
                ? t("Compartilhada com o grupo", "Shared with the group")
                : t("Conversa privada", "Private conversation")}
            </small>
          </div>
          {id && (
            <DismissibleDetails className="ai-menu">
              <summary
                aria-label={t("Opções da conversa", "Conversation options")}
              >
                •••
              </summary>
              <div>
                <button onClick={() => setPanel("rename")}>
                  {t("Renomear", "Rename")}
                </button>
                {allowGroups && !conversation?.group_id && (
                  <button disabled={!!active} onClick={() => setPanel("share")}>
                    {t("Compartilhar uma cópia", "Share a copy")}
                  </button>
                )}
                <button disabled={!!active} onClick={() => setPanel("delete")}>
                  {t("Excluir conversa", "Delete conversation")}
                </button>
              </div>
            </DismissibleDetails>
          )}
        </header>
        {!enabled && (
          <p className="ai-notice" role="status">
            {t(
              "O assistente está desativado. O administrador pode conectar um servidor de IA; seu histórico permanece salvo.",
              "The assistant is disabled. An administrator can connect an AI server; your history stays saved.",
            )}
          </p>
        )}
        {panel && (
          <div className="ai-action-panel">
            <button
              className="ai-panel-close"
              aria-label={t("Fechar", "Close")}
              onClick={() => {
                setPanel(null);
                setConfirmed(false);
              }}
            >
              <IconX size={18} />
            </button>
            {panel === "rename" ? (
              <>
                <h3>{t("Renomear conversa", "Rename conversation")}</h3>
                <label>
                  {t("Nome", "Name")}
                  <input
                    maxLength={160}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !title.trim()}
                  onClick={() => void action("rename")}
                >
                  {t("Salvar", "Save")}
                </button>
              </>
            ) : panel === "delete" ? (
              <>
                <h3>
                  {t("Excluir esta conversa?", "Delete this conversation?")}
                </h3>
                <p>
                  {t(
                    "O histórico e seus anexos serão removidos desta conversa. Cópias compartilhadas ficam separadas.",
                    "History and attachments will be removed from this conversation. Shared copies stay separate.",
                  )}
                </p>
                <button disabled={busy} onClick={() => void action("delete")}>
                  {t("Excluir conversa", "Delete conversation")}
                </button>
              </>
            ) : (
              <>
                <h3>
                  {t(
                    "Compartilhar uma cópia com o grupo",
                    "Share a copy with the group",
                  )}
                </h3>
                <p>
                  {messages.length}{" "}
                  {t(
                    "mensagens. A conversa privada original permanece separada.",
                    "messages. Your original private conversation remains separate.",
                  )}
                </p>
                <ul>
                  {sources.map((s) => (
                    <li key={s.id}>
                      {s.title}
                      {s.attachment ? t(" · anexo", " · attachment") : ""}
                    </li>
                  ))}
                </ul>
                <label>
                  {t("Grupo", "Group")}
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    <option value="">{t("Selecione", "Select")}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  {t(
                    "Revisei o histórico e os anexos que serão compartilhados.",
                    "I reviewed the history and attachments to be shared.",
                  )}
                </label>
                <button
                  disabled={busy || !group || !confirmed}
                  onClick={() => void action("share")}
                >
                  {t("Criar cópia para o grupo", "Create group copy")}
                </button>
              </>
            )}
          </div>
        )}
        <div
          className="ai-messages"
          ref={listRef}
          onScroll={(e) => {
            const node = e.currentTarget;
            stick.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 80;
          }}
          aria-live="polite"
        >
          {!messages.length && (
            <div className="ai-empty">
              <IconRobot size={38} />
              <h3>
                {t(
                  "Pergunte, compare e organize suas ideias",
                  "Ask, compare and organize your ideas",
                )}
              </h3>
              <p>
                {t(
                  "Crie uma conversa e selecione apenas as fontes que deseja usar. O assistente não altera seus conteúdos.",
                  "Create a conversation and select only the sources you want to use. The assistant cannot change your content.",
                )}
              </p>
            </div>
          )}
          {messages.map((m) => (
            <article key={m.id} className={`ai-message ai-message-${m.role}`}>
              <header>
                <strong>
                  {m.role === "assistant"
                    ? t("Assistente de IA", "AI assistant")
                    : (m.author_name ?? t("Pessoa removida", "Removed person"))}
                </strong>
                <time dateTime={new Date(m.created_at).toISOString()}>
                  {new Date(m.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </header>
              <div className="ai-message-text">
                {m.content ||
                  (m.status === "pending"
                    ? t(
                        "Na fila ou preparando resposta…",
                        "Queued or preparing a reply…",
                      )
                    : t("Sem resposta.", "No response."))}
              </div>
              {["interrupted", "error"].includes(m.status) && (
                <p className="ai-response-status">
                  {m.status === "interrupted"
                    ? t(
                        "Resposta interrompida · conteúdo parcial preservado",
                        "Interrupted reply · partial content preserved",
                      )
                    : t(
                        "Não foi possível concluir a resposta. Tente novamente.",
                        "Unable to complete the reply. Please try again.",
                      )}
                </p>
              )}
              {sources
                .filter((s) => s.messageId === m.id)
                .map((s) =>
                  s.attachment ? (
                    <a key={s.id} href={`/api/ai/attachment?id=${s.id}`}>
                      {s.title} ↓
                    </a>
                  ) : (
                    <small key={s.id}>
                      [{s.label}] {t("Fonte:", "Source:")} {s.title}
                    </small>
                  ),
                )}
            </article>
          ))}
        </div>
        {error && (
          <p className="ai-notice" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="ai-notice" role="status">
            {notice}
          </p>
        )}
        {id && (
          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            onDragOver={(e) => {
              if (allowFiles) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (allowFiles) addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            {sourcePicker && (
              <fieldset className="ai-source-picker">
                <legend>
                  {t(
                    "Escolha as fontes desta mensagem",
                    "Choose sources for this message",
                  )}
                </legend>
                {choices.length ? (
                  choices.map((s, i) => (
                    <label key={`${s.kind}-${s.id}-${s.path ?? ""}`}>
                      <input
                        type="checkbox"
                        checked={selected.includes(i)}
                        disabled={!selected.includes(i) && selected.length >= 8}
                        onChange={(e) =>
                          setSelected((items) =>
                            e.target.checked
                              ? [...items, i]
                              : items.filter((n) => n !== i),
                          )
                        }
                      />
                      <span>
                        {s.title}
                        <small>{s.kind}</small>
                      </span>
                    </label>
                  ))
                ) : (
                  <p>
                    {t("Nenhuma fonte disponível.", "No sources available.")}
                  </p>
                )}
              </fieldset>
            )}
            {!!files.length && (
              <ul className="ai-attachments">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      aria-label={t("Remover anexo", "Remove attachment")}
                      onClick={() =>
                        setFiles((current) => current.filter((_, n) => n !== i))
                      }
                    >
                      <IconX size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="ai-draft">
              <span className="sr-only">{t("Mensagem", "Message")}</span>
              <textarea
                rows={2}
                maxLength={10000}
                disabled={!enabled}
                value={draft}
                placeholder={t("Escreva sua pergunta…", "Write your question…")}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
            </label>
            <div className="ai-composer-actions">
              <div>
                {allowFiles && (
                  <>
                    <input
                      hidden
                      ref={fileRef}
                      type="file"
                      multiple
                      accept={`.pdf,.docx,.txt,.md,.markdown${vision ? ",.png,.jpg,.jpeg,.webp" : ""}`}
                      onChange={(e) => {
                        addFiles(Array.from(e.target.files ?? []));
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={!!active || !enabled}
                      onClick={() => fileRef.current?.click()}
                      title={t("Anexar arquivos", "Attach files")}
                    >
                      <IconPaperclip size={19} />
                    </button>
                  </>
                )}
                {allowSources && (
                  <button
                    type="button"
                    disabled={!!active || !enabled}
                    onClick={async () => {
                      setSourcePicker(!sourcePicker);
                      if (!choices.length)
                        try {
                          setChoices((await api("sources")).sources);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Error");
                        }
                    }}
                  >
                    <IconFileText size={18} />
                    {t("Fontes", "Sources")}
                    {selected.length ? ` (${selected.length})` : ""}
                  </button>
                )}
              </div>
              {active ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api("cancel", { id: active });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >
                  <IconPlayerStop size={18} />
                  {t("Parar", "Stop")}
                </button>
              ) : (
                <button
                  disabled={!enabled || busy || !draft.trim()}
                  type="submit"
                >
                  <IconSend size={18} />
                  {t("Enviar", "Send")}
                </button>
              )}
            </div>
            <small>
              {t(
                "Enter envia · Shift+Enter quebra linha · até 4 anexos de 10 MB",
                "Enter sends · Shift+Enter adds a line · up to 4 attachments of 10 MB",
              )}
            </small>
          </form>
        )}
      </div>
    </section>
  );
}
