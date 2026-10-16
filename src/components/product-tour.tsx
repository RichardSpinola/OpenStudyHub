"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconCompass,
  IconArrowLeft,
  IconArrowRight,
  IconSparkles,
  IconPlayerPlay,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import {
  getProductTourAction,
  saveProductTourAction,
} from "@/app/tour/actions";
import {
  PRODUCT_TOUR_EDITION,
  type TourMode,
  type TourStep,
  type TourStatus,
} from "@/lib/product-tour-catalog";
import type { ProductTourContext } from "@/lib/product-tour";
import { PlanningDialog } from "./planning-dialog";
import { useUiText, useUiLanguage } from "./ui-language-provider";

export function TourLauncher() {
  const tr = useUiText();
  return (
    <button
      type="button"
      className="tour-launcher"
      data-tour="tour-launcher"
      onClick={() => window.dispatchEvent(new Event("osh:open-tour"))}
    >
      <IconCompass size={25} />
      <span>
        <strong>{tr("Conheça o Hub", "Discover Hub")}</strong>
        <small>
          {tr(
            "Tour completo, novidades ou continuar de onde parou.",
            "Full tour, highlights or resume where you left off.",
          )}
        </small>
      </span>
      <IconArrowRight size={18} />
    </button>
  );
}
export function ProductTour({ userId }: { userId: number }) {
  const tr = useUiText(),
    language = useUiLanguage(),
    router = useRouter(),
    path = usePathname(),
    query = useSearchParams();
  const [context, setContext] = useState<ProductTourContext | null>(null),
    [view, setView] = useState<"closed" | "choice" | "active" | "done">(
      "closed",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const initialized = useRef(false),
    previousPath = useRef(path),
    current = useRef<ProductTourContext | null>(null),
    busyRef = useRef(false);
  const updateContext = useCallback((ctx: ProductTourContext | null) => {
    current.current = ctx;
    setContext(ctx);
  }, []);
  useEffect(() => {
    const load =
      !initialized.current ||
      (previousPath.current === "/onboarding" && path !== "/onboarding");
    previousPath.current = path;
    if (!load) return;
    let ignore = false;
    getProductTourAction()
      .then((ctx) => {
        if (ignore) return;
        initialized.current = true;
        updateContext(ctx);
        const safe =
          [
            "/",
            "/today",
            "/subjects",
            "/notes",
            "/library",
            "/extras",
            "/settings",
          ].includes(path) && !query.get("create");
        if (
          ctx?.eligible &&
          safe &&
          ctx.invitationEnabled &&
          (!ctx.progress || ctx.progress.edition < PRODUCT_TOUR_EDITION)
        )
          setView("choice");
      })
      .catch(() => {
        /* The app stays usable if the optional invitation cannot be loaded. */
      });
    return () => {
      ignore = true;
    };
  }, [path, query, updateContext, userId]);
  useEffect(() => {
    const open = () => {
      setError("");
      setNotice("");
      setView("choice");
      getProductTourAction()
        .then(updateContext)
        .catch(() =>
          setError(
            tr(
              "Não foi possível abrir o tour. Tente novamente.",
              "Could not open the tour. Try again.",
            ),
          ),
        );
    };
    window.addEventListener("osh:open-tour", open);
    return () => window.removeEventListener("osh:open-tour", open);
  }, [tr, updateContext]);
  const progress = context?.progress;
  const mode = progress?.mode ?? "full",
    steps = context?.steps.filter((s) => mode === "full" || s.news) ?? [];
  const index = Math.max(
      0,
      steps.findIndex((s) => s.id === progress?.stepId),
    ),
    step = steps[index];
  const route = path + (query.toString() ? `?${query}` : "");
  const matched = step ? route === step.path : false;
  useEffect(() => {
    if (view === "active" && step && !matched)
      router.push(step.path, { scroll: false });
  }, [view, step, matched, router]);
  async function persist(
    status: TourStatus,
    mode: TourMode,
    stepId: string | null,
  ) {
    if (busyRef.current) return false;
    const ctx = current.current;
    if (!ctx?.eligible) {
      setError(
        tr(
          "O tour está indisponível neste momento.",
          "The tour is unavailable right now.",
        ),
      );
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveProductTourAction({
        edition: PRODUCT_TOUR_EDITION,
        status,
        mode,
        stepId,
        revision: ctx.progress?.revision ?? 0,
      });
      if ("error" in result) {
        setError(
          tr(
            "Não foi possível salvar o progresso. Tente novamente.",
            "Could not save progress. Try again.",
          ),
        );
        return false;
      }
      updateContext({ ...ctx, progress: result.progress });
      if (result.conflict) {
        setView("choice");
        setError(
          tr(
            "O progresso mudou em outra aba. Escolha continuar ou reiniciar.",
            "Progress changed in another tab. Choose to resume or restart.",
          ),
        );
        return false;
      }
      return true;
    } catch {
      setError(
        tr(
          "Não foi possível salvar o progresso. Tente novamente.",
          "Could not save progress. Try again.",
        ),
      );
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function begin(nextMode: TourMode, resume = false) {
    const available =
      context?.steps.filter((s) => nextMode === "full" || s.news) ?? [];
    const target = resume
      ? (available.find((s) => s.id === progress?.stepId) ?? available[0])
      : available[0];
    if (target && (await persist("active", nextMode, target.id)))
      setView("active");
  }
  async function move(offset: number) {
    const target = steps[index + offset];
    if (target) {
      await persist("active", mode, target.id);
    } else if (
      offset > 0 &&
      (await persist("completed", mode, step?.id ?? null))
    )
      setView("done");
  }
  async function leave() {
    if (busyRef.current) return;
    const ok = await persist(
      view === "active" ? "paused" : "dismissed",
      mode,
      view === "active" ? (step?.id ?? null) : null,
    );
    if (!ok && current.current?.progress?.status === "active")
      setNotice(
        tr(
          "O progresso pode não ter sido salvo. Você pode retomar pela Ajuda.",
          "Progress may not have saved. You can resume from Help.",
        ),
      );
    setView("closed");
  }
  const resume =
    progress?.edition === PRODUCT_TOUR_EDITION &&
    ["active", "paused"].includes(progress.status) &&
    context?.steps.some((s) => s.id === progress.stepId);
  return (
    <>
      {view === "choice" ? (
        <PlanningDialog
          title={tr("Conheça o Hub", "Discover Hub")}
          onClose={() => {
            if (!busy) void leave();
          }}
        >
          <p>
            {context?.newUser
              ? tr(
                  "Vamos conhecer seu espaço? O tour mostra os recursos nas páginas de verdade, um passo de cada vez.",
                  "Ready to explore? The tour shows tools on the real pages, one step at a time.",
                )
              : tr(
                  "Explore o Hub desde o começo ou conheça as novidades. Você pode pular e voltar pela Ajuda quando quiser.",
                  "Explore Hub from the beginning or discover highlights. Skip now and return from Help whenever you like.",
                )}
          </p>
          <p className="panel-help">
            {tr(
              "O tour muda de páginas. Salve o que estiver editando antes de começar. Nenhuma mensagem ou arquivo será enviado por ele.",
              "The tour changes pages. Save any work before starting. It will not send messages or upload files.",
            )}
          </p>
          {context && !context.eligible ? (
            <p role="status">
              {tr(
                "Conclua o primeiro acesso e aguarde o fim do modo de prova, se estiver ativo, para iniciar.",
                "Complete initial setup and wait for any active exam mode to end before starting.",
              )}
            </p>
          ) : null}
          <div className="tour-choice-grid">
            {resume ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void begin(progress!.mode, true)}
              >
                <IconPlayerPlay size={22} />
                <span>
                  <strong>
                    {tr("Continuar de onde parei", "Resume tour")}
                  </strong>
                  <small>
                    {tr(
                      "Seu progresso ficou guardado.",
                      "Your progress was saved.",
                    )}
                  </small>
                </span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || !context?.eligible}
              onClick={() => void begin("full")}
            >
              <IconCompass size={24} />
              <span>
                <strong>{tr("Tour completo", "Full tour")}</strong>
                <small>
                  {tr(
                    "Conheça todas as áreas desde o começo.",
                    "Explore every area from the beginning.",
                  )}
                </small>
              </span>
            </button>
            <button
              type="button"
              disabled={busy || !context?.eligible}
              onClick={() => void begin("news")}
            >
              <IconSparkles size={24} />
              <span>
                <strong>
                  {tr("Conhecer as novidades", "Discover highlights")}
                </strong>
                <small>
                  {tr(
                    "Um percurso mais curto pelos recursos novos.",
                    "A shorter journey through the new features.",
                  )}
                </small>
              </span>
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <div className="planning-actions">
            <button type="button" disabled={busy} onClick={() => void leave()}>
              {busy ? tr("Salvando…", "Saving…") : tr("Agora não", "Not now")}
            </button>
          </div>
        </PlanningDialog>
      ) : null}
      {view === "active" && step ? (
        <TourSpotlight
          key={`${step.id}:${matched ? "ready" : "loading"}`}
          step={step}
          matched={matched}
          position={index + 1}
          total={steps.length}
          english={language === "en"}
          busy={busy}
          error={error}
          onPrevious={() => void move(-1)}
          onNext={() => void move(1)}
          onExit={() => void leave()}
        />
      ) : null}
      {view === "done" ? (
        <PlanningDialog
          title={tr(
            "Seu espaço está pronto para explorar",
            "Your space is ready to explore",
          )}
          onClose={() => setView("closed")}
        >
          <div className="tour-done">
            <IconCheck size={35} />
            <p>
              {tr(
                "Você pode refazer o tour ou conhecer as novidades em Configurações → Ajuda → Conheça o Hub.",
                "Repeat the tour or explore highlights in Settings → Help → Discover Hub.",
              )}
            </p>
          </div>
          <div className="planning-actions">
            <button
              type="button"
              onClick={() => {
                setView("closed");
                router.push("/");
              }}
            >
              {tr("Ir para a Home", "Go to Home")}
            </button>
            <button type="button" onClick={() => setView("closed")}>
              {tr("Fechar", "Close")}
            </button>
          </div>
        </PlanningDialog>
      ) : null}
      {view === "closed" && notice ? (
        <div className="tour-notice" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label={tr("Fechar", "Close")}
          >
            <IconX size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}

function TourSpotlight({
  step,
  matched,
  position,
  total,
  english,
  busy,
  error,
  onPrevious,
  onNext,
  onExit,
}: {
  step: TourStep;
  matched: boolean;
  position: number;
  total: number;
  english: boolean;
  busy: boolean;
  error: string;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const tr = useUiText(),
    dialog = useRef<HTMLDialogElement>(null),
    card = useRef<HTMLDivElement>(null),
    [box, setBox] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
      cardX: number;
      cardY: number;
    } | null>(null),
    [missing, setMissing] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    let frame = 0,
      timer: ReturnType<typeof setTimeout> | undefined,
      settled: ReturnType<typeof setTimeout> | undefined;
    let target: HTMLElement | null = null;
    if (!matched) return;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!target?.isConnected) return;
        const r = target.getBoundingClientRect(),
          padding = 6,
          w = innerWidth,
          h = innerHeight;
        const x = Math.max(8, r.left - padding),
          y = Math.max(8, r.top - padding),
          right = Math.min(w - 8, r.right + padding),
          bottom = Math.min(h - 8, r.bottom + padding);
        const cw = Math.min(384, w - 24),
          ch = card.current?.offsetHeight ?? 300;
        const besideRight = right + 12 + cw <= w - 12;
        const besideLeft = x - 12 - cw >= 12;
        const cardX = besideRight
          ? right + 12
          : besideLeft
            ? x - 12 - cw
            : Math.max(12, Math.min(w - cw - 12, x));
        const cardY =
          besideRight || besideLeft
            ? Math.max(12, Math.min(y, h - ch - 12))
            : bottom + 12 + ch < h - 12
              ? bottom + 12
              : y - ch - 12 > 12
                ? y - ch - 12
                : Math.max(12, h - ch - 12);
        const next = {
          x,
          y,
          width: Math.max(0, right - x),
          height: Math.max(0, bottom - y),
          cardX,
          cardY,
        };
        setBox((old) =>
          JSON.stringify(old) === JSON.stringify(next) ? old : next,
        );
      });
    };
    const resize = new ResizeObserver(update);
    const locate = () => {
      const found = document.querySelector<HTMLElement>(
        `[data-tour="${step.target}"]`,
      );
      if (!found || !found.getClientRects().length) return false;
      target = found;
      found.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "instant",
      });
      resize.observe(found);
      if (card.current) resize.observe(card.current);
      update();
      settled = setTimeout(update, 220);
      return true;
    };
    const observer = new MutationObserver(() => {
      if (locate()) {
        observer.disconnect();
        if (timer) clearTimeout(timer);
      }
    });
    if (!locate()) {
      observer.observe(
        document.getElementById("main-content") ?? document.body,
        { childList: true, subtree: true },
      );
      timer = setTimeout(() => {
        observer.disconnect();
        setMissing(true);
      }, 5000);
    }
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      resize.disconnect();
      cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
      if (settled) clearTimeout(settled);
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
    };
  }, [step.id, step.target, matched]);
  return (
    <dialog
      ref={dialog}
      className="tour-spotlight-dialog"
      aria-label={english ? step.titleEn : step.title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onExit();
      }}
    >
      {box && box.width > 0 && box.height > 0 ? (
        <div
          aria-hidden="true"
          className="tour-spotlight-hole"
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
        />
      ) : (
        <div className="tour-spotlight-shade" />
      )}
      <div
        ref={card}
        className="tour-step-card"
        style={box ? { left: box.cardX, top: box.cardY } : undefined}
      >
        <header>
          <span>
            <IconCompass size={17} />
            {tr("Conheça o Hub", "Discover Hub")} · {position}/{total}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={onExit}
            aria-label={tr(
              "Sair e guardar progresso",
              "Exit and save progress",
            )}
          >
            <IconX size={19} />
          </button>
        </header>
        <progress
          value={position}
          max={total}
          aria-label={tr("Progresso do tour", "Tour progress")}
        />
        <h2>{english ? step.titleEn : step.title}</h2>
        <p>{english ? step.bodyEn : step.body}</p>
        {!matched ? (
          <p role="status" className="panel-help">
            {tr("Abrindo a página…", "Opening page…")}
          </p>
        ) : missing ? (
          <p role="status" className="panel-help">
            {tr(
              "Não foi possível destacar esta área agora. Você pode pular esta parte e voltar depois.",
              "This area could not be highlighted. Skip this step and return later.",
            )}
          </p>
        ) : null}
        {error ? <p role="alert">{error}</p> : null}
        <footer>
          <button
            type="button"
            disabled={busy || position === 1}
            onClick={onPrevious}
          >
            <IconArrowLeft size={17} />
            {tr("Voltar", "Back")}
          </button>
          <button type="button" disabled={busy} onClick={onNext}>
            {position === total
              ? tr("Concluir", "Finish")
              : tr("Avançar", "Next")}
            <IconArrowRight size={17} />
          </button>
        </footer>
        <div className="tour-step-secondary">
          <button type="button" disabled={busy} onClick={onNext}>
            {tr("Pular esta parte", "Skip this step")}
          </button>
          <button type="button" disabled={busy} onClick={onExit}>
            {tr("Sair", "Exit")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
