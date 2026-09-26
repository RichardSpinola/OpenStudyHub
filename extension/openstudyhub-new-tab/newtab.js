/* global chrome */
const status = document.querySelector("#status");
const configure = document.querySelector("#configure");

configure.addEventListener("click", () => chrome.runtime.openOptionsPage());

chrome.storage.local.get("instanceUrl", ({ instanceUrl }) => {
  try {
    const url = new URL(instanceUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid instance URL");
    location.replace(url.origin);
  } catch {
    status.textContent = "Configure a URL da sua instância para começar.";
    configure.hidden = false;
  }
});
