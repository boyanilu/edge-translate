const DEFAULT_SETTINGS = {
  model: "qwen-mt-flash",
  targetLang: "Chinese",
  displayMode: "floating"
};

const form = document.getElementById("popup-form");
const statusNode = document.getElementById("status");
const openOptionsButton = document.getElementById("open-options");
const openPdfViewerButton = document.getElementById("open-pdf-viewer");
const openCurrentPdfButton = document.getElementById("open-current-pdf");

init().catch((error) => {
  setStatus(error.message || "加载设置失败。", "error");
});

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

openPdfViewerButton.addEventListener("click", () => {
  openPdfViewerPage();
});

openCurrentPdfButton.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const src = extractPdfSource(tab?.url || "");
    if (!src) {
      setStatus("当前标签页不是可识别的 PDF 页面。", "error");
      return;
    }

    openPdfViewerPage(src);
  } catch (error) {
    setStatus(error.message || "无法打开当前 PDF。", "error");
  }
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

function openPdfViewerPage(src) {
  const url = src
    ? chrome.runtime.getURL(`pdf-viewer.html?src=${encodeURIComponent(src)}`)
    : chrome.runtime.getURL("pdf-viewer.html");

  chrome.tabs.create({ url });
  window.close();
}

function extractPdfSource(url) {
  if (!url) {
    return "";
  }

  const normalized = url.toLowerCase();
  if (normalized.endsWith(".pdf") || normalized.includes(".pdf?") || normalized.includes(".pdf#")) {
    return url;
  }

  // Edge or Chrome built-in PDF viewers may keep the original file URL in a query param.
  try {
    const parsed = new URL(url);
    const src = parsed.searchParams.get("src") || parsed.searchParams.get("file");
    if (!src) {
      return "";
    }

    const decoded = decodeURIComponent(src);
    const decodedLower = decoded.toLowerCase();
    if (decodedLower.endsWith(".pdf") || decodedLower.includes(".pdf?") || decodedLower.includes(".pdf#")) {
      return decoded;
    }
  } catch (_error) {
    return "";
  }

  return "";
}

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone || "";
}
