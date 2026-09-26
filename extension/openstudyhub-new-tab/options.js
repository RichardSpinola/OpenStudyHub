/* global chrome */
const form = document.querySelector("#settings-form");
const input = document.querySelector("#instance-url");
const test = document.querySelector("#test");
const feedback = document.querySelector("#feedback");

function normalizeInstanceUrl(value) {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Informe somente o endereço base HTTP ou HTTPS, sem caminho, senha ou parâmetros.",
    );
  return url.origin;
}

chrome.storage.local.get("instanceUrl", ({ instanceUrl }) => {
  if (typeof instanceUrl === "string") {
    input.value = instanceUrl;
    test.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const instanceUrl = normalizeInstanceUrl(input.value);
    await chrome.storage.local.set({ instanceUrl });
    input.value = instanceUrl;
    test.disabled = false;
    feedback.textContent =
      "URL salva. As próximas abas abrirão essa instância.";
    feedback.dataset.state = "success";
  } catch (error) {
    feedback.textContent =
      error instanceof TypeError
        ? "Digite uma URL válida, como https://openstudyhub.exemplo.org."
        : error.message;
    feedback.dataset.state = "error";
  }
});

input.addEventListener("input", () => {
  test.disabled = true;
  feedback.textContent = "";
});

test.addEventListener("click", () => {
  try {
    window.open(normalizeInstanceUrl(input.value), "_blank", "noopener");
  } catch {
    feedback.textContent = "Salve uma URL válida antes de abrir a instância.";
    feedback.dataset.state = "error";
  }
});
