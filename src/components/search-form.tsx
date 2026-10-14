"use client";
import { UiCopy, useUiTranslations } from "@/components/ui-language-provider";
import { useEffect, useRef, useState } from "react";
import type { Appearance } from "@/lib/appearance";

const engineLabels: Record<Appearance["searchEngine"], string> = {
  google: "Google",
  scholar: "Google Acadêmico",
  duckduckgo: "DuckDuckGo",
  startpage: "Startpage",
  ecosia: "Ecosia",
};
export function SearchForm({
  engine = "google",
  autocompleteAvailable = false,
}: {
  engine?: Appearance["searchEngine"];
  autocompleteAvailable?: boolean;
}) {
  const clickedSuggestion = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { search } = useUiTranslations();
  useEffect(() => {
    const focus = () => {
      if (
        !window.matchMedia("(min-width: 769px) and (pointer: fine)").matches ||
        document.querySelector("dialog[open]")
      )
        return;
      const current = document.activeElement;
      if (
        current !== inputRef.current &&
        current instanceof HTMLElement &&
        current.matches("input,textarea,select,[contenteditable=true]")
      )
        return;
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    };
    const visible = () => {
      if (!document.hidden) focus();
    };
    const key = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key === "/" &&
        !(
          target instanceof HTMLElement &&
          target.closest("input,textarea,select,[contenteditable=true]")
        )
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    focus();
    window.addEventListener("keydown", key);
    window.addEventListener("focus", focus);
    window.addEventListener("pageshow", focus);
    document.addEventListener("visibilitychange", visible);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
      document.removeEventListener("visibilitychange", visible);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  useEffect(() => {
    if (
      !autocompleteAvailable ||
      query.trim().length < 2 ||
      query.trim().length > 160 ||
      !open
    )
      return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/home-search/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query.trim() }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("unavailable");
        const payload = (await response.json()) as { suggestions?: unknown };
        if (!controller.signal.aborted) {
          setSuggestions(
            Array.isArray(payload.suggestions)
              ? payload.suggestions
                  .filter(
                    (value): value is string =>
                      typeof value === "string" && value.length <= 160,
                  )
                  .slice(0, 6)
              : [],
          );
          setActive(-1);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setActive(-1);
        }
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, autocompleteAvailable, open]);
  const expanded = open && suggestions.length > 0;
  return (
    <form
      ref={formRef}
      className="search-form"
      action="/search"
      method="get"
      rel="noopener noreferrer"
      role="search"
      target="_blank"
      onSubmit={() => {
        const selected =
          clickedSuggestion.current ??
          (expanded && active >= 0 ? suggestions[active] : undefined);
        clickedSuggestion.current = null;
        if (selected && inputRef.current) {
          inputRef.current.value = selected;
          setQuery(selected);
        }
        setOpen(false);
        setActive(-1);
      }}
    >
      <label className="sr-only" htmlFor="home-search">
        {search.label}
      </label>
      <input type="hidden" name="engine" value={engine} />
      <div className="search-control">
        <span className="search-prompt" aria-hidden="true">
          SEARCH:
        </span>
        <input
          ref={inputRef}
          id="home-search"
          name="q"
          type="search"
          placeholder={search.placeholder}
          autoComplete="off"
          required
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls="home-search-suggestions"
          aria-activedescendant={
            expanded && active >= 0 ? `home-suggestion-${active}` : undefined
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setSuggestions([]);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
              return;
            }
            if (!expanded || !["ArrowDown", "ArrowUp"].includes(event.key))
              return;
            event.preventDefault();
            setActive((index) =>
              event.key === "ArrowDown"
                ? (index + 1) % suggestions.length
                : index <= 0
                  ? suggestions.length - 1
                  : index - 1,
            );
          }}
        />
        <button type="submit" aria-label={search.submit}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
        <ul
          id="home-search-suggestions"
          className="home-search-suggestions"
          role="listbox"
          aria-label={search.label}
          hidden={!expanded}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`home-suggestion-${index}`}
              role="option"
              aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                clickedSuggestion.current = suggestion;
                if (inputRef.current) inputRef.current.value = suggestion;
                setQuery(suggestion);
                setActive(-1);
                setOpen(false);
                // Submit the selected suggestion synchronously, through the existing search route.
                formRef.current?.requestSubmit();
              }}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      </div>
      <p className="search-help">
        <UiCopy pt="Busca na web ·" en="Web search ·" /> {engineLabels[engine]}
      </p>
      {autocompleteAvailable ? (
        <small className="search-suggestions-provider">
          <UiCopy
            pt="Sugestões Brave: o texto digitado é enviado ao provedor."
            en="Brave suggestions: typed text is sent to the provider."
          />
        </small>
      ) : null}
    </form>
  );
}
