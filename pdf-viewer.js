import * as pdfjsLib from "./vendor/pdfjs/build/pdf.mjs";
import { EventBus, PDFLinkService, PDFViewer } from "./vendor/pdfjs/web/pdf_viewer.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdfjs/build/pdf.worker.mjs");

const PDF_SETTINGS_KEY = "pdfViewerSettings";
const DEFAULT_VIEWER_SETTINGS = {
  instantTranslate: false
};

const viewerContainer = document.getElementById("viewer-container");
const viewerNode = document.getElementById("viewer");
const statusNode = document.getElementById("status");
const docMetaNode = document.getElementById("doc-meta");
const fileInput = document.getElementById("file-input");
const urlInput = document.getElementById("url-input");
const translateTrigger = document.getElementById("translate-trigger");
const translatePanel = document.getElementById("translate-panel");
const translatedTextNode = document.getElementById("translated-text");
const translateStatusNode = document.getElementById("translate-status");
const translateMetaNode = document.getElementById("translate-meta");
const instantTranslateToggle = document.getElementById("instant-translate");
const pickFileButton = document.getElementById("pick-file");
const loadUrlButton = document.getElementById("load-url");
const zoomOutButton = document.getElementById("zoom-out");
const zoomInButton = document.getElementById("zoom-in");
const fitWidthButton = document.getElementById("fit-width");
const closePanelButton = document.getElementById("close-panel");
const copyTranslationButton = document.getElementById("copy-translation");
const openOptionsButton = document.getElementById("open-options");

const state = {
  pdfDocument: null,
  selectedText: "",
  requestId: 0,
  instantTranslate: DEFAULT_VIEWER_SETTINGS.instantTranslate
};

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const pdfViewer = new PDFViewer({
  container: viewerContainer,
  viewer: viewerNode,
  eventBus,
  linkService,
  textLayerMode: 1,
  annotationMode: pdfjsLib.AnnotationMode.DISABLE,
  removePageBorders: false
});

linkService.setViewer(pdfViewer);

eventBus.on("pagesinit", () => {
  pdfViewer.currentScaleValue = "page-width";
});

pickFileButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
loadUrlButton.addEventListener("click", () => {
  const src = urlInput.value.trim();
  if (!src) {
    setStatus("请输入 PDF 链接或文件路径。", "error");
    return;
  }

  void loadPdfFromUrl(src);
});

zoomOutButton.addEventListener("click", () => {
  pdfViewer.currentScale = Math.max(0.5, pdfViewer.currentScale * 0.9);
});

zoomInButton.addEventListener("click", () => {
  pdfViewer.currentScale = Math.min(3, pdfViewer.currentScale * 1.1);
});

fitWidthButton.addEventListener("click", () => {
  pdfViewer.currentScaleValue = "page-width";
});

instantTranslateToggle.addEventListener("change", () => {
  state.instantTranslate = instantTranslateToggle.checked;
  void saveViewerSettings();
  if (state.instantTranslate) {
    hideTrigger();
  }
});

viewerContainer.addEventListener("mouseup", handleSelectionChange, true);
document.addEventListener("mousedown", handleOutsideClick, true);
document.addEventListener("keydown", handleKeyboardShortcut, true);
translateTrigger.addEventListener("click", () => {
  void translateSelection();
});
closePanelButton.addEventListener("click", () => {
  translatePanel.hidden = true;
});

copyTranslationButton.addEventListener("click", async () => {
  await copyText(translatedTextNode.textContent.trim(), "已复制翻译结果。");
});

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

bootstrap().catch((error) => {
  setStatus(error.message || "PDF 阅读器初始化失败。", "error");
});

async function bootstrap() {
  await loadViewerSettings();

  const query = new URLSearchParams(window.location.search);
  const src = query.get("src");

  if (src) {
    urlInput.value = src;
    await loadPdfFromUrl(src);
    return;
  }

  setStatus("请选择一个 PDF 文件，或输入 PDF 地址。", "");
}

async function loadViewerSettings() {
  const result = await chrome.storage.local.get([PDF_SETTINGS_KEY]);
  const settings = {
    ...DEFAULT_VIEWER_SETTINGS,
    ...(result[PDF_SETTINGS_KEY] || {})
  };

  state.instantTranslate = Boolean(settings.instantTranslate);
  instantTranslateToggle.checked = state.instantTranslate;
}

async function saveViewerSettings() {
  await chrome.storage.local.set({
    [PDF_SETTINGS_KEY]: {
      instantTranslate: state.instantTranslate
    }
  });
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const data = new Uint8Array(await file.arrayBuffer());
  await loadPdfDocument({ data }, file.name);
  fileInput.value = "";
}

async function loadPdfFromUrl(src) {
  await loadPdfDocument(
    {
      url: src,
      cMapUrl: chrome.runtime.getURL("vendor/pdfjs/cmaps/"),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL("vendor/pdfjs/standard_fonts/")
    },
    src
  );
}

async function loadPdfDocument(source, label) {
  try {
    setStatus("正在加载 PDF...", "");
    await closeCurrentDocument();

    const loadingTask = pdfjsLib.getDocument({
      ...source,
      enableXfa: false,
      isEvalSupported: false
    });

    const pdfDocument = await loadingTask.promise;
    state.pdfDocument = pdfDocument;
    state.selectedText = "";
    state.requestId += 1;

    pdfViewer.setDocument(pdfDocument);
    linkService.setDocument(pdfDocument, null);

    hideTrigger();
    translatePanel.hidden = true;
    translatedTextNode.textContent = "";
    translateStatusNode.textContent = "";
    translateMetaNode.textContent = "";
    docMetaNode.textContent = `${label} · 共 ${pdfDocument.numPages} 页`;
    setStatus("PDF 已加载，可以直接划词翻译。", "success");
  } catch (error) {
    console.error("[edge-translate:pdf] load failed:", error);
    setStatus(error.message || "PDF 加载失败。", "error");
  }
}

async function closeCurrentDocument() {
  if (!state.pdfDocument) {
    return;
  }

  pdfViewer.setDocument(null);
  linkService.setDocument(null, null);
  await state.pdfDocument.destroy();
  state.pdfDocument = null;
}

function handleSelectionChange(event) {
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : "";

  if (!text || !viewerContainer.contains(event.target)) {
    hideTrigger();
    return;
  }

  state.selectedText = text;

  if (state.instantTranslate) {
    hideTrigger();
    void translateSelection();
    return;
  }

  const containerRect = viewerContainer.getBoundingClientRect();
  const maxX = Math.max(12, viewerContainer.scrollWidth - 52);
  const maxY = Math.max(12, viewerContainer.scrollHeight - 52);
  const triggerX = clamp(
    event.clientX - containerRect.left + viewerContainer.scrollLeft + 12,
    12,
    maxX
  );
  const triggerY = clamp(
    event.clientY - containerRect.top + viewerContainer.scrollTop + 12,
    12,
    maxY
  );

  translateTrigger.style.left = `${triggerX}px`;
  translateTrigger.style.top = `${triggerY}px`;
  translateTrigger.hidden = false;
}

function handleOutsideClick(event) {
  if (translateTrigger.contains(event.target)) {
    return;
  }

  if (translatePanel.contains(event.target)) {
    return;
  }

  if (!viewerContainer.contains(event.target)) {
    hideTrigger();
  }
}

function handleKeyboardShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "enter") {
    void translateSelection();
  }
}

async function translateSelection() {
  const text = state.selectedText.trim();
  if (!text) {
    return;
  }

  const currentRequestId = ++state.requestId;
  hideTrigger();
  translatePanel.hidden = false;
  translatedTextNode.textContent = "";
  translateMetaNode.textContent = "";
  translateStatusNode.textContent = "翻译中...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "translate",
      payload: {
        text
      }
    });

    if (currentRequestId !== state.requestId) {
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error || "翻译失败。");
    }

    translatedTextNode.textContent = response.result.translatedText || "";
    translateStatusNode.textContent = "翻译结果";
    translateMetaNode.textContent = `模型：${response.result.model || "unknown"}`;
  } catch (error) {
    if (currentRequestId !== state.requestId) {
      return;
    }

    translateStatusNode.textContent = "翻译失败";
    translatedTextNode.textContent = error.message || "请求失败。";
    translateMetaNode.textContent = "";
  }
}

async function copyText(text, successMessage) {
  if (!text) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    translateMetaNode.textContent = successMessage;
  } catch (_error) {
    translateMetaNode.textContent = "复制失败，请手动复制。";
  }
}

function hideTrigger() {
  translateTrigger.hidden = true;
}

function setStatus(message, tone) {
  statusNode.textContent = message;
  statusNode.dataset.tone = tone || "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
