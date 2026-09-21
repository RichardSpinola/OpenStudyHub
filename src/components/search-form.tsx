"use client";

import { useEffect, useRef } from "react";
import { useUiTranslations } from "@/components/ui-language-provider";

export function SearchForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { search } = useUiTranslations();

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      const isEditing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.key === "/" && !isEditing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <form
      className="search-form"
      action="/search"
      method="get"
      rel="noopener noreferrer"
      role="search"
      target="_blank"
    >
      <label className="sr-only" htmlFor="home-search">
        {search.label}
      </label>
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
        />
        <button type="submit" aria-label={search.submit}>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 5 5" />
          </svg>
        </button>
      </div>
      <p className="search-help">{search.mode}</p>
    </form>
  );
}
