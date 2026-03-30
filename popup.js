const DEFAULT_SETTINGS = {
  model: "qwen-mt-flash",
  targetLang: "Chinese",
  displayMode: "floating"
};

const form = document.getElementById("popup-form");
const statusNode = document.getElementById("status");
const openOptionsButton = document.getElementById("open-options");

init();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const { settings } = await chrome.storage.local.get(["settings"]);
    const nextSettings = {
      ...(settings || {}),
      ...getFormData()
    };

    await chrome.storage.local.set({ settings: nextSettings });
    setStatus("快速设置已保存。", "success");
  } catch (error) {
    setStatus(error.message || "保存失败。", "error");
  }
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

async function init() {
  const { settings } = await chrome.storage.local.get(["settings"]);
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };

  document.getElementById("model").value = merged.model || DEFAULT_SETTINGS.model;
  document.getElementById("target-lang").value = merged.targetLang || DEFAULT_SETTINGS.targetLang;
  document.getElementById("display-mode").value = merged.displayMode || DEFAULT_SETTINGS.displayMode;
}

function getFormData() {
  return {
    model: document.getElementById("model").value.trim() || DEFAULT_SETTINGS.model,
    targetLang: document.getElementById("target-lang").value || DEFAULT_SETTINGS.targetLang,
    displayMode: document.getElementById("display-mode").value || DEFAULT_SETTINGS.displayMode
  };
}

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone || "";
}
