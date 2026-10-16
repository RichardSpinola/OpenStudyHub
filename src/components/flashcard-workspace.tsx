"use client";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import { ExtraWorkspace } from "@/components/extra-workspace";
import { useUiText } from "@/components/ui-language-provider";
import type { Deck, Flashcard } from "@/lib/flashcards";
type Person = { id: number; displayName: string };
type Index = {
  decks: Deck[];
  userId: number;
  people: Person[];
  groups: { id: number; name: string }[];
  offerings: { offeringId: number; subjectName: string; periodLabel: string }[];
};
type Detail = {
  deck: Deck;
  cards: Flashcard[];
  shares: {
    people: { id: number; name: string }[];
    groups: { id: number; name: string }[];
  } | null;
};
export function FlashcardWorkspace() {
  const tr = useUiText(),
    [index, setIndex] = useState<Index | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [scope, setScope] = useState("all"),
    [creating, setCreating] = useState(false),
    [editingDeck, setEditingDeck] = useState(false),
    [editingCard, setEditingCard] = useState<Flashcard | null>(null),
    [review, setReview] = useState<number[] | null>(null),
    [flipped, setFlipped] = useState(false),
    [done, setDone] = useState(0),
    [repeated, setRepeated] = useState(0),
    [finished, setFinished] = useState(false),
    [sharing, setSharing] = useState(false),
    [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const fetchJson = useCallback(
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || tr("Tente novamente.", "Try again."));
      return data;
    },
    [tr],
  );
  async function refresh() {
    const data = (await fetchJson("/api/extras/flashcards")) as Index;
    setIndex(data);
  }
  useEffect(() => {
    let current = true;
    fetchJson("/api/extras/flashcards")
      .then((data) => {
        if (current) setIndex(data);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [fetchJson]);
  async function open(id: number) {
    setError("");
    setBusy(true);
    try {
      const data = (await fetchJson(
        `/api/extras/flashcards?deck=${id}`,
      )) as Detail;
      setDetail(data);
      setReview(null);
      setFinished(false);
      setEditingCard(null);
      setEditingDeck(false);
      setSharing(false);
      setPendingRemove(null);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }
  async function act(value: Record<string, unknown>, reload = true) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/extras/flashcards", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value),
        }),
        data = (await response.json()) as { id: number; error?: string };
      if (!response.ok) throw new Error(data.error);
      if (reload) {
        const selected = (await fetchJson(
          `/api/extras/flashcards?deck=${data.id}`,
        )) as Detail;
        setDetail(selected);
        await refresh();
      }
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr(
              "Não foi possível salvar. Tente novamente.",
              "Could not save. Try again.",
            ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveDeck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (
      await act({
        type: "deck",
        id: editingDeck ? detail?.deck.id : undefined,
        title: form.get("title"),
        description: form.get("description"),
        offeringId: form.get("offeringId")
          ? Number(form.get("offeringId"))
          : null,
      })
    ) {
      setCreating(false);
      setEditingDeck(false);
    }
  }
  const owner = !!detail && index?.userId === detail.deck.ownerId,
    card = detail?.cards.find((c) => c.id === review?.[0]);
  async function startReview() {
    if (!detail || busy) return;
    setBusy(true);
    setError("");
    try {
      const latest = (await fetchJson(
        `/api/extras/flashcards?deck=${detail.deck.id}`,
      )) as Detail;
      if (latest.deck.archivedAt)
        throw new Error(
          tr("O baralho foi arquivado.", "This deck was archived."),
        );
      setDetail(latest);
      setReview(latest.cards.map((c) => c.id));
      setDone(0);
      setRepeated(0);
      setFlipped(false);
      setFinished(false);
      setSharing(false);
    } catch (error) {
      setReview(null);
      setDetail(null);
      setError(
        error instanceof Error
          ? error.message
          : tr(
              "Confira seu acesso e tente novamente.",
              "Check your access and retry.",
            ),
      );
      void refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  async function grade(known: boolean) {
    if (!card || !detail) return;
    if (
      await act(
        { type: "review", deckId: detail.deck.id, cardId: card.id, known },
        false,
      )
    ) {
      setReview((q) =>
        q ? (known ? q.slice(1) : [...q.slice(1), q[0]]) : null,
      );
      setFlipped(false);
      if (known) setDone((n) => n + 1);
      else setRepeated((n) => n + 1);
      if (known && review?.length === 1) {
        setFinished(true);
        setReview(null);
        void refresh().catch(() =>
          setError(
            tr(
              "Não foi possível atualizar a lista. Tente novamente.",
              "Could not refresh the list. Try again.",
            ),
          ),
        );
      }
    } else {
      setReview(null);
      setDetail(null);
      void refresh().catch(() => undefined);
    }
  }
  return (
    <ExtraWorkspace title="Flashcards">
      <div className="flashcard-workspace">
        {error ? (
          <p role="alert" className="feedback-banner is-error">
            {error}{" "}
            {!index ? (
              <button
                disabled={busy}
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                {tr("Tentar novamente", "Try again")}
              </button>
            ) : null}
          </p>
        ) : null}
        <div className="flashcard-layout">
          <aside className="flashcard-sidebar">
            <button
              disabled={busy}
              onClick={() => {
                setCreating(true);
                setDetail(null);
                setReview(null);
                setEditingDeck(false);
                setFinished(false);
              }}
            >
              + {tr("Novo baralho", "New deck")}
            </button>
            <nav aria-label={tr("Seções dos flashcards", "Flashcard sections")}>
              {[
                ["all", tr("Todos", "All")],
                ["mine", tr("Meus baralhos", "My decks")],
                ["shared", tr("Compartilhados comigo", "Shared with me")],
                ["archived", tr("Arquivados", "Archived")],
              ].map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={scope === id}
                  onClick={() => {
                    setScope(id);
                    setDetail(null);
                    setCreating(false);
                    setReview(null);
                    setFinished(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
            <p className="tool-muted">
              {tr(
                "Seu progresso é pessoal, mesmo nos baralhos compartilhados.",
                "Your progress is personal, even in shared decks.",
              )}
            </p>
          </aside>
          <section
            className="flashcard-main"
            aria-label={tr("Conteúdo dos flashcards", "Flashcard content")}
          >
            {creating || editingDeck ? (
              <form
                className="tool-form"
                key={editingDeck ? detail?.deck.id : "new"}
                onSubmit={saveDeck}
              >
                <h2>
                  {tr(
                    editingDeck ? "Editar baralho" : "Novo baralho",
                    editingDeck ? "Edit deck" : "New deck",
                  )}
                </h2>
                <label>
                  {tr("Nome", "Name")}
                  <input
                    name="title"
                    required
                    maxLength={180}
                    defaultValue={editingDeck ? detail?.deck.title : ""}
                  />
                </label>
                <label>
                  {tr("Descrição · opcional", "Description · optional")}
                  <textarea
                    name="description"
                    maxLength={2000}
                    defaultValue={editingDeck ? detail?.deck.description : ""}
                  />
                </label>
                <label>
                  {tr("Disciplina · opcional", "Subject · optional")}
                  <select
                    name="offeringId"
                    defaultValue={
                      editingDeck ? (detail?.deck.offeringId ?? "") : ""
                    }
                  >
                    <option value="">
                      {tr("Sem disciplina", "No subject")}
                    </option>
                    {index?.offerings.map((o) => (
                      <option key={o.offeringId} value={o.offeringId}>
                        {o.subjectName} · {o.periodLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="tool-muted">
                  {tr(
                    "O baralho começa privado. Compartilhe depois de criar.",
                    "The deck starts private. Share it after creating.",
                  )}
                </p>
                <div className="tool-actions">
                  <button disabled={busy}>
                    {busy
                      ? tr("Salvando…", "Saving…")
                      : tr("Salvar baralho", "Save deck")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCreating(false);
                      setEditingDeck(false);
                    }}
                  >
                    {tr("Cancelar", "Cancel")}
                  </button>
                </div>
              </form>
            ) : !detail ? (
              <>
                <h2>
                  {tr(
                    scope === "archived" ? "Arquivados" : "Seus baralhos",
                    scope === "archived" ? "Archived" : "Your decks",
                  )}
                </h2>
                {!index ? (
                  <p>{tr("Carregando…", "Loading…")}</p>
                ) : (
                  <div className="deck-grid">
                    {index.decks
                      .filter((d) =>
                        scope === "archived"
                          ? !!d.archivedAt
                          : !d.archivedAt &&
                            (scope === "all" ||
                              (scope === "mine"
                                ? d.ownerId === index.userId
                                : d.ownerId !== index.userId)),
                      )
                      .map((d) => (
                        <button
                          key={d.id}
                          className="deck-card"
                          disabled={busy}
                          onClick={() => void open(d.id)}
                        >
                          <span aria-hidden="true">▤</span>
                          <strong>{d.title}</strong>
                          <small>
                            {d.count}{" "}
                            {d.count === 1
                              ? tr("cartão", "card")
                              : tr("cartões", "cards")}{" "}
                            · {d.known} {tr("já sei", "known")}
                          </small>
                          <small>
                            {d.subjectName ?? tr("Pessoal", "Personal")} ·{" "}
                            {d.ownerName}
                          </small>
                        </button>
                      ))}
                  </div>
                )}
                {index &&
                !index.decks.some((d) =>
                  scope === "archived"
                    ? !!d.archivedAt
                    : !d.archivedAt &&
                      (scope === "all" ||
                        (scope === "mine"
                          ? d.ownerId === index.userId
                          : d.ownerId !== index.userId)),
                ) ? (
                  <p>
                    {tr(
                      "Nenhum baralho aqui. Crie um novo ou escolha outra seção.",
                      "No decks here. Create one or choose another section.",
                    )}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <header className="deck-heading">
                  <div>
                    <h2>{detail.deck.title}</h2>
                    <p>{detail.deck.description}</p>
                    <small>
                      {detail.deck.count}{" "}
                      {detail.deck.count === 1
                        ? tr("cartão", "card")
                        : tr("cartões", "cards")}{" "}
                      · {detail.deck.ownerName}
                      {!owner
                        ? " · " +
                          tr("Compartilhado para leitura", "Shared for reading")
                        : ""}
                    </small>
                  </div>
                  <button
                    onClick={() => {
                      setDetail(null);
                      setReview(null);
                      setFinished(false);
                    }}
                  >
                    {tr("← Baralhos", "← Decks")}
                  </button>
                </header>
                {detail.deck.archivedAt ? (
                  <div className="tool-empty">
                    <p>
                      {tr(
                        "Este baralho está arquivado. O conteúdo e o progresso foram mantidos.",
                        "This deck is archived. Content and progress were kept.",
                      )}
                    </p>
                    {owner ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act({
                            type: "archive",
                            deckId: detail.deck.id,
                            archived: false,
                          })
                        }
                      >
                        {tr("Restaurar baralho", "Restore deck")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {review ? (
                      <section className="review-session">
                        <div className="tool-actions">
                          <span>
                            {done} {tr("concluídos", "done")} · {review.length}{" "}
                            {tr("na fila", "remaining")}
                          </span>
                          <button
                            onClick={() => {
                              setReview(null);
                              setFinished(true);
                              void refresh().catch(() =>
                                setError(
                                  tr(
                                    "Não foi possível atualizar a lista. Tente novamente.",
                                    "Could not refresh the list. Try again.",
                                  ),
                                ),
                              );
                            }}
                          >
                            {tr("Encerrar sessão", "End session")}
                          </button>
                        </div>
                        {card ? (
                          <>
                            <span className="page-kicker">
                              {flipped
                                ? tr("Resposta", "Answer")
                                : tr("Pergunta", "Question")}
                            </span>
                            <div className="flashcard-face">
                              {flipped ? card.answer : card.question}
                            </div>
                            {flipped ? (
                              <div className="tool-actions">
                                <button
                                  disabled={busy}
                                  onClick={() => void grade(false)}
                                >
                                  {tr("Rever novamente", "Review again")}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => void grade(true)}
                                >
                                  {tr("Já sei", "Got it")}
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setFlipped(true)}>
                                {tr("Mostrar resposta", "Show answer")}
                              </button>
                            )}
                          </>
                        ) : (
                          <p>
                            {tr(
                              "Nenhum cartão disponível.",
                              "No cards available.",
                            )}
                          </p>
                        )}
                      </section>
                    ) : (
                      <>
                        {finished ? (
                          <div className="tool-empty" role="status">
                            <h3>
                              {tr("Sessão concluída", "Session complete")}
                            </h3>
                            <p>
                              {done}{" "}
                              {done === 1
                                ? tr("cartão concluído", "card completed")
                                : tr(
                                    "cartões concluídos",
                                    "cards completed",
                                  )}{" "}
                              · {repeated}{" "}
                              {repeated === 1
                                ? tr("repetição", "repeat")
                                : tr("repetições", "repeats")}
                            </p>
                          </div>
                        ) : null}
                        <div className="tool-actions">
                          <button
                            disabled={busy || !detail.cards.length}
                            onClick={startReview}
                          >
                            {tr("Começar revisão", "Start review")}
                          </button>
                          {owner ? (
                            <>
                              <button
                                onClick={() => {
                                  setSharing(!sharing);
                                  setEditingCard(null);
                                }}
                              >
                                {tr("Compartilhar", "Share")}
                              </button>
                              <button onClick={() => setEditingDeck(true)}>
                                {tr("Editar baralho", "Edit deck")}
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void act({
                                    type: "archive",
                                    deckId: detail.deck.id,
                                    archived: true,
                                  })
                                }
                              >
                                {tr("Arquivar", "Archive")}
                              </button>
                            </>
                          ) : null}
                        </div>
                        {sharing && detail.shares ? (
                          <section className="tool-panel">
                            <h3>
                              {tr(
                                "Compartilhar para leitura",
                                "Share for reading",
                              )}
                            </h3>
                            <p>
                              {tr(
                                "As pessoas podem estudar. Apenas você altera os cartões.",
                                "People can study. Only you can edit cards.",
                              )}
                            </p>
                            {(["person", "group"] as const).map((target) => (
                              <div key={target}>
                                <form
                                  className="tool-form"
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = new FormData(e.currentTarget);
                                    await act({
                                      type: "share",
                                      deckId: detail.deck.id,
                                      target,
                                      targetId: Number(form.get("targetId")),
                                      enabled: true,
                                    });
                                  }}
                                >
                                  <label>
                                    {tr(
                                      target === "person" ? "Pessoa" : "Grupo",
                                      target === "person" ? "Person" : "Group",
                                    )}
                                    <select
                                      name="targetId"
                                      required
                                      defaultValue=""
                                    >
                                      <option value="" disabled>
                                        {tr("Selecione", "Select")}
                                      </option>
                                      {(target === "person"
                                        ? index?.people.map((p) => ({
                                            id: p.id,
                                            name: p.displayName,
                                          }))
                                        : index?.groups
                                      )?.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button disabled={busy}>
                                    {tr("Compartilhar", "Share")}
                                  </button>
                                </form>
                                <ul>
                                  {(target === "person"
                                    ? detail.shares!.people
                                    : detail.shares!.groups
                                  ).map((p) => (
                                    <li key={p.id}>
                                      {p.name}{" "}
                                      <button
                                        disabled={busy}
                                        onClick={() =>
                                          void act({
                                            type: "share",
                                            deckId: detail.deck.id,
                                            target,
                                            targetId: p.id,
                                            enabled: false,
                                          })
                                        }
                                      >
                                        {tr("Remover acesso", "Remove access")}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </section>
                        ) : null}
                        {owner ? (
                          <form
                            className="tool-form card-editor"
                            key={editingCard?.id ?? "new-card"}
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const formElement = e.currentTarget,
                                form = new FormData(formElement);
                              if (
                                await act({
                                  type: "card",
                                  deckId: detail.deck.id,
                                  id: editingCard?.id,
                                  question: form.get("question"),
                                  answer: form.get("answer"),
                                })
                              ) {
                                formElement.reset();
                                setEditingCard(null);
                              }
                            }}
                          >
                            <h3>
                              {tr(
                                editingCard
                                  ? "Editar cartão"
                                  : "Adicionar cartão",
                                editingCard ? "Edit card" : "Add card",
                              )}
                            </h3>
                            <label>
                              {tr("Pergunta", "Question")}
                              <textarea
                                name="question"
                                required
                                maxLength={1000}
                                defaultValue={editingCard?.question ?? ""}
                              />
                            </label>
                            <label>
                              {tr("Resposta", "Answer")}
                              <textarea
                                name="answer"
                                required
                                maxLength={4000}
                                defaultValue={editingCard?.answer ?? ""}
                              />
                            </label>
                            <div className="tool-actions">
                              <button disabled={busy}>
                                {busy
                                  ? tr("Salvando…", "Saving…")
                                  : tr(
                                      editingCard
                                        ? "Salvar cartão"
                                        : "Adicionar cartão",
                                      editingCard ? "Save card" : "Add card",
                                    )}
                              </button>
                              {editingCard ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setEditingCard(null)}
                                >
                                  {tr("Cancelar edição", "Cancel edit")}
                                </button>
                              ) : null}
                            </div>
                          </form>
                        ) : null}
                        <div className="flashcard-list">
                          {detail.cards.map((c) => (
                            <article key={c.id}>
                              <strong>{c.question}</strong>
                              <details>
                                <summary>
                                  {tr("Ver resposta", "Show answer")}
                                </summary>
                                <p>{c.answer}</p>
                              </details>
                              {owner ? (
                                <div className="tool-actions">
                                  <button
                                    disabled={busy}
                                    onClick={() => {
                                      setEditingCard(c);
                                      setPendingRemove(null);
                                      document
                                        .querySelector(".card-editor")
                                        ?.scrollIntoView({
                                          behavior: "smooth",
                                          block: "start",
                                        });
                                    }}
                                  >
                                    {tr("Editar", "Edit")}
                                  </button>
                                  {pendingRemove === c.id ? (
                                    <>
                                      <span>
                                        {tr(
                                          "Excluir este cartão e seu progresso?",
                                          "Delete this card and its progress?",
                                        )}
                                      </span>
                                      <button
                                        disabled={busy}
                                        onClick={async () => {
                                          if (
                                            await act({
                                              type: "remove-card",
                                              deckId: detail.deck.id,
                                              id: c.id,
                                            })
                                          ) {
                                            setPendingRemove(null);
                                            if (editingCard?.id === c.id)
                                              setEditingCard(null);
                                          }
                                        }}
                                      >
                                        {tr(
                                          "Confirmar exclusão",
                                          "Confirm deletion",
                                        )}
                                      </button>
                                      <button
                                        disabled={busy}
                                        onClick={() => setPendingRemove(null)}
                                      >
                                        {tr("Cancelar", "Cancel")}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      disabled={busy}
                                      onClick={() => setPendingRemove(c.id)}
                                    >
                                      {tr("Excluir", "Delete")}
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </ExtraWorkspace>
  );
}
