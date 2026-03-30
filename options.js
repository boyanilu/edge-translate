const DEFAULT_SETTINGS = {
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "",
  model: "qwen-mt-flash",
  targetLang: "Chinese",
  displayMode: "floating"
};

const statusNode = document.getElementById("status");
const testButton = document.getElementById("test-button");
const form = document.getElementById("settings-form");

init();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = getFormData();

  await chrome.storage.local.set({ settings });
  setStatus("设置已保存。刷新目标网页后即可应用新的显示模式。", "success");
});

testButton.addEventListener("click", async () => {
  const settings = getFormData();

  try {
    setStatus("正在测试连接...", "");
    await chrome.storage.local.set({ settings });

    const response = await chrome.runtime.sendMessage({
      type: "test-connection",
      payload: {
        text: "我看到这个视频后没有笑"
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "连接测试失败。");
    }

    setStatus(`连接成功，测试翻译结果：${response.result.translatedText}`, "success");
  } catch (error) {
    setStatus(error.message || "连接测试失败。", "error");
  }
});

async function init() {
  const { settings } = await chrome.storage.local.get(["settings"]);
  fillForm(normalizeStoredSettings(settings || {}));
}

function normalizeStoredSettings(settings) {
  const baseURL = settings.baseURL || settings.apiUrl || DEFAULT_SETTINGS.baseURL;

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    baseURL: normalizeBaseURL(baseURL)
  };
}

function fillForm(settings) {
  document.getElementById("base-url").value = settings.baseURL || "";
  document.getElementById("api-key").value = settings.apiKey || "";
  document.getElementById("model").value = settings.model || "";
  document.getElementById("target-lang").value = settings.targetLang || DEFAULT_SETTINGS.targetLang;
  document.getElementById("display-mode").value = settings.displayMode || DEFAULT_SETTINGS.displayMode;
}

function getFormData() {
  return {
    baseURL: normalizeBaseURL(document.getElementById("base-url").value),
    apiKey: document.getElementById("api-key").value.trim(),
    model: document.getElementById("model").value.trim(),
    targetLang: document.getElementById("target-lang").value || DEFAULT_SETTINGS.targetLang,
    displayMode: document.getElementById("display-mode").value || DEFAULT_SETTINGS.displayMode
  };
}

function normalizeBaseURL(input) {
  return input.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone || "";
}
