(() => {
  const landing = document.querySelector(".osh-landing");
  if (!landing) {
    const content = document.querySelector(".md-content__inner");
    if (content && !content.querySelector(".osh-docs-ascii")) {
      const banner = document.createElement("pre");
      banner.className = "osh-docs-ascii";
      banner.setAttribute("aria-hidden", "true");
      banner.textContent = String.raw`  _   __        _   _   _  __
 / \ (_  |_|   | \ / \ /  (_
 \_/ __) | |   |_/ \_/ \_ __)

 OPENSTUDYHUB :: DOCUMENTATION`;
      content.prepend(banner);
    }
    return;
  }
  const buttons = [...landing.querySelectorAll(".osh-language button")];
  function select(language) {
    landing.dataset.landingLang = language;
    document.documentElement.lang = language === "en" ? "en" : "pt-BR";
    buttons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.lang === language),
      ),
    );
    try {
      localStorage.setItem("osh.landing.language", language);
    } catch {}
  }
  buttons.forEach((button) =>
    button.addEventListener("click", () => select(button.dataset.lang)),
  );
  let saved = "pt";
  try {
    if (localStorage.getItem("osh.landing.language") === "en") saved = "en";
  } catch {}
  select(saved);
})();
