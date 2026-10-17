/* Section and preview navigation for the public documentation. */
(() => {
  const terminal = document.querySelector("[data-tui]");
  if (!terminal) return;
  const panels = [...terminal.querySelectorAll("[data-tui-panel]")];
  const links = [...terminal.querySelectorAll("[data-tui-link]")];
  const screen = terminal.querySelector(".tui-screen");
  const names = new Set(panels.map((panel) => panel.id));
  const select = (id, { update = true, focus = false } = {}) => {
    if (!names.has(id)) return false;
    panels.forEach((panel) => {
      panel.hidden = panel.id !== id;
    });
    links.forEach((link) => {
      if (link.dataset.tuiLink === id)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.querySelectorAll(".osh-language-bar a").forEach((link) => {
      const url = new URL(link.href, document.baseURI);
      url.hash = id;
      link.href = url.href;
    });
    screen.scrollTop = 0;
    if (update) window.history.replaceState(null, "", `#${id}`);
    if (focus) {
      const heading = document.getElementById(id).querySelector("h1, h2");
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    return true;
  };
  const fromHash = () => {
    const hash = location.hash.slice(1);
    const legacy = {
      "osh-title": "overview",
      "osh-academic-title": "overview",
      "osh-work-title": "workspace",
      "osh-control-title": "administration",
    };
    select(legacy[hash] || hash || "overview", { update: false });
  };
  terminal.classList.add("is-interactive");
  select("overview", { update: false });
  fromHash();
  window.addEventListener("hashchange", fromHash);
  links.forEach((link) =>
    link.addEventListener("click", (event) => {
      if (
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      select(link.dataset.tuiLink, { focus: true });
    }),
  );
  const previews = [...terminal.querySelectorAll(".tui-preview")];
  const previewButtons = [...terminal.querySelectorAll("[data-tui-preview]")];
  terminal.querySelector("[data-tui-previews]").hidden = false;
  previews.forEach((preview, index) => {
    preview.hidden = index !== 0;
  });
  previewButtons.forEach((button, index) =>
    button.addEventListener("click", () => {
      previews.forEach((preview, selected) => {
        preview.hidden = selected !== index;
        preview.open = selected === index;
      });
      screen.scrollTop = 0;
    }),
  );
  previews.forEach((preview) =>
    preview.addEventListener("toggle", () => {
      previewButtons.forEach((button, index) =>
        button.setAttribute("aria-pressed", String(previews[index].open)),
      );
    }),
  );
  document.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing
    )
      return;
    if (
      event.target.closest?.(
        "input, textarea, select, button, a, summary, [contenteditable='true'], [role='dialog']",
      )
    )
      return;
    const index = Number(event.key) - 1;
    if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      select(panels[index].id, { focus: true });
    }
  });
})();
