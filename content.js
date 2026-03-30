(function () {
  const DEFAULT_UI_SETTINGS = {
    displayMode: "floating"
  };

  const state = {
    selectedText: "",
    isLoading: false,
    anchorPoint: null,
    pinned: false,
    requestId: 0,
    settings: { ...DEFAULT_UI_SETTINGS },
    drag: {
      active: false,
      offsetX: 0,
      offsetY: 0
    }
  };

  const root = createRoot();
  const trigger = createTriggerButton();
  const panel = createPanel();
  const header = panel.querySelector(".__edge_translate_header__");
  const pinButton = panel.querySelector("[data-action='pin']");

  root.appendChild(trigger);
  root.appendChild(panel);
  document.documentElement.appendChild(root);

  loadSettings();
  chrome.storage.onChanged.addListener(handleStorageChange);

  document.addEventListener("mouseup", handleSelectionChange, true);
  document.addEventListener("keyup", handleSelectionChange, true);
  document.addEventListener("mousedown", handleOutsideClick, true);
  document.addEventListener("mousemove", handleDragMove, true);
  document.addEventListener("mouseup", handleDragEnd, true);

  trigger.addEventListener("click", () => {
    if (!state.selectedText || state.isLoading) {
      return;
    }

    translateSelection();
  });

  panel.querySelector("[data-action='copy']").addEventListener("click", copyResult);
  panel.querySelector("[data-action='copy-original']").addEventListener("click", copyOriginalText);
  panel.querySelector("[data-action='settings']").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-options" });
  });
  pinButton.addEventListener("click", togglePinned);
  pinButton.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  header.addEventListener("mousedown", handleDragStart);
  panel.addEventListener(
    "wheel",
    (event) => {
      event.stopPropagation();
    },
    { passive: true }
  );

  async function loadSettings() {
    const { settings } = await chrome.storage.local.get(["settings"]);
    state.settings = {
      ...DEFAULT_UI_SETTINGS,
      ...(settings || {})
    };
    applyModeSettings();
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "local" || !changes.settings) {
      return;
    }

    const previousMode = getDisplayMode();
    state.settings = {
      ...DEFAULT_UI_SETTINGS,
      ...(changes.settings.newValue || {})
    };

    if (previousMode !== getDisplayMode()) {
      state.pinned = false;
      updatePinUI();
      applySidebarPinnedLayout(false);
      hideAll();
    }

    applyModeSettings();
  }

  function applyModeSettings() {
    panel.dataset.displayMode = getDisplayMode();

    if (getDisplayMode() === "sidebar") {
      trigger.hidden = true;
    }

    if (getDisplayMode() !== "sidebar") {
      applySidebarPinnedLayout(false);
    } else if (state.pinned && !panel.hidden) {
      applySidebarPinnedLayout(true);
    }
  }

  function getDisplayMode() {
    return state.settings.displayMode === "sidebar" ? "sidebar" : "floating";
  }

  function handleSelectionChange(event) {
    if (root.contains(event.target)) {
      return;
    }

    if (shouldIgnoreSelection()) {
      return;
    }

    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    if (!text) {
      return;
    }

    const rect = getSelectionRect();
    state.anchorPoint = resolveAnchorPoint(event, rect);
    state.selectedText = text;

    console.log("[edge-translate] selected text:", JSON.stringify(state.selectedText));

    if (getDisplayMode() === "sidebar" || state.pinned) {
      trigger.hidden = true;
      translateSelection({
        rect,
        preservePosition: state.pinned && !panel.hidden
      });
      return;
    }

    updatePanelText("", "", true);
    showTrigger(state.anchorPoint);
  }

  function shouldIgnoreSelection() {
    const active = document.activeElement;
    if (!active) {
      return false;
    }

    const tagName = active.tagName?.toLowerCase();
    return tagName === "input" || tagName === "textarea" || active.isContentEditable;
  }

  function showTrigger(anchorPoint) {
    if (!anchorPoint) {
      hideAll();
      return;
    }

    const top = clamp(
      window.scrollY + anchorPoint.clientY + 12,
      window.scrollY + 12,
      window.scrollY + window.innerHeight - 48
    );
    const left = clamp(
      window.scrollX + anchorPoint.clientX + 12,
      window.scrollX + 12,
      window.scrollX + window.innerWidth - 48
    );

    trigger.style.top = `${top}px`;
    trigger.style.left = `${left}px`;
    trigger.hidden = false;
    panel.hidden = true;
  }

  function positionPanel(rect) {
    if (getDisplayMode() === "sidebar") {
      positionSidebar();
      return;
    }

    const placement = computeFloatingPlacement(rect);
    panel.dataset.displayMode = "floating";
    panel.style.top = `${placement.top}px`;
    panel.style.left = `${placement.left}px`;
    panel.style.right = "";
    panel.hidden = false;
    panel.style.visibility = "";
    panel.dataset.placement = placement.name;
  }

  function positionSidebar() {
    panel.dataset.displayMode = "sidebar";
    panel.dataset.placement = state.pinned ? "sidebar-pinned" : "sidebar-drawer";
    panel.style.left = "";
    panel.style.top = "";
    panel.style.right = "";
    panel.hidden = false;
    panel.style.visibility = "";
    applySidebarPinnedLayout(state.pinned);
  }

  async function translateSelection(options = {}) {
    const rect = options.rect || getSelectionRect();
    const currentRequestId = ++state.requestId;

    state.isLoading = true;
    root.dataset.loading = "true";
    trigger.hidden = true;

    if (getDisplayMode() === "sidebar") {
      positionSidebar();
    } else if (!(state.pinned && options.preservePosition && !panel.hidden)) {
      positionPanel(rect);
    } else {
      panel.hidden = false;
      panel.style.visibility = "";
    }

    panel.dataset.state = "loading";
    panel.querySelector("[data-role='status']").textContent = "翻译中...";
    panel.querySelector("[data-role='translation']").textContent = "";
    panel.querySelector("[data-role='meta']").textContent = "";
    panel.querySelector("[data-action='copy']").disabled = true;

    try {
      console.log("[edge-translate] sending selected text:", JSON.stringify(state.selectedText));
      const response = await chrome.runtime.sendMessage({
        type: "translate",
        payload: {
          text: state.selectedText
        }
      });

      if (currentRequestId !== state.requestId) {
        return;
      }

      if (!response?.ok) {
        throw new Error(response?.error || "翻译失败。");
      }

      updatePanelText(response.result.translatedText, response.result.model, false);
      panel.dataset.state = "done";
    } catch (error) {
      if (currentRequestId !== state.requestId) {
        return;
      }

      showError(error.message || "翻译失败。");
    } finally {
      if (currentRequestId === state.requestId) {
        state.isLoading = false;
        root.dataset.loading = "false";
      }
    }
  }

  function updatePanelText(translatedText, modelName, hidePanel) {
    panel.querySelector("[data-role='status']").textContent = hidePanel ? "" : "翻译结果";
    panel.querySelector("[data-role='translation']").textContent = translatedText;
    panel.querySelector("[data-role='meta']").textContent = modelName ? `模型：${modelName}` : "";
    panel.querySelector("[data-action='copy']").disabled = !translatedText;
    panel.hidden = hidePanel;
  }

  function showError(message) {
    state.isLoading = false;
    root.dataset.loading = "false";
    panel.dataset.state = "error";
    panel.querySelector("[data-role='status']").textContent = message;
    panel.querySelector("[data-role='translation']").textContent = "";
    panel.querySelector("[data-role='meta']").textContent = "";
    panel.querySelector("[data-action='copy']").disabled = true;
    panel.hidden = false;
  }

  async function copyResult() {
    const result = panel.querySelector("[data-role='translation']").textContent.trim();
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result);
      panel.querySelector("[data-role='meta']").textContent = "已复制到剪贴板";
    } catch (_error) {
      panel.querySelector("[data-role='meta']").textContent = "复制失败，请手动复制";
    }
  }

  async function copyOriginalText() {
    const sourceText = state.selectedText.trim();
    if (!sourceText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sourceText);
      panel.querySelector("[data-role='meta']").textContent = "已复制原文到剪贴板";
    } catch (_error) {
      panel.querySelector("[data-role='meta']").textContent = "原文复制失败，请手动复制";
    }
  }

  function handleOutsideClick(event) {
    if (root.contains(event.target) || state.pinned) {
      return;
    }

    hideAll();
  }

  function hideAll() {
    state.requestId += 1;
    state.isLoading = false;
    state.selectedText = "";
    state.anchorPoint = null;
    state.drag.active = false;
    trigger.hidden = true;
    panel.hidden = true;
    panel.dataset.state = "idle";
    panel.dataset.dragging = "false";
    root.dataset.loading = "false";
    applySidebarPinnedLayout(false);
  }

  function togglePinned(event) {
    event.stopPropagation();
    state.pinned = !state.pinned;
    updatePinUI();
    trigger.hidden = true;

    if (getDisplayMode() === "sidebar") {
      positionSidebar();
      return;
    }

    if (state.pinned) {
      panel.hidden = false;
      panel.style.visibility = "";
    }
  }

  function updatePinUI() {
    panel.dataset.pinned = state.pinned ? "true" : "false";
    pinButton.textContent = state.pinned ? "取消固定" : "固定";
  }

  function applySidebarPinnedLayout(enabled) {
    const body = document.body;
    const className = "__edge_translate_sidebar_pinned";

    if (!body) {
      return;
    }

    if (enabled && getDisplayMode() === "sidebar") {
      const sidebarWidth = panel.offsetWidth || 328;
      body.style.setProperty("--edge-translate-sidebar-width", `${sidebarWidth}px`);
      body.classList.add(className);
      return;
    }

    body.classList.remove(className);
    body.style.removeProperty("--edge-translate-sidebar-width");
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0).cloneRange();
    if (range.collapsed) {
      return null;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width || rect.height) {
      return rect;
    }

    const rects = range.getClientRects();
    return rects.length ? rects[0] : null;
  }

  function computeFloatingPlacement(rect) {
    const gap = 12;
    const fallback = {
      top: window.scrollY + 80,
      left: clamp(
        window.scrollX + window.innerWidth - 388,
        window.scrollX + gap,
        window.scrollX + window.innerWidth - 372
      ),
      name: "fallback"
    };

    if (!rect) {
      panel.hidden = false;
      panel.style.visibility = "hidden";
      return fallback;
    }

    panel.dataset.displayMode = "floating";
    panel.hidden = false;
    panel.style.visibility = "hidden";
    panel.style.left = `${window.scrollX + gap}px`;
    panel.style.top = `${window.scrollY + gap}px`;

    const panelWidth = panel.offsetWidth || 360;
    const panelHeight = panel.offsetHeight || 280;
    const maxLeft = Math.max(gap, window.innerWidth - panelWidth - gap);
    const maxTop = Math.max(gap, window.innerHeight - panelHeight - gap);

    const candidates = [
      {
        name: "below",
        left: clamp(rect.left, gap, maxLeft),
        top: clamp(rect.bottom + gap, gap, maxTop)
      },
      {
        name: "right",
        left: clamp(rect.right + gap, gap, maxLeft),
        top: clamp(rect.bottom - panelHeight, gap, maxTop)
      },
      {
        name: "left",
        left: clamp(rect.left - panelWidth - gap, gap, maxLeft),
        top: clamp(rect.bottom - panelHeight, gap, maxTop)
      },
      {
        name: "above",
        left: clamp(rect.left, gap, maxLeft),
        top: clamp(rect.top - panelHeight - gap, gap, maxTop)
      }
    ];

    const ranked = candidates
      .map((candidate, index) => {
        const panelRect = {
          left: candidate.left,
          top: candidate.top,
          right: candidate.left + panelWidth,
          bottom: candidate.top + panelHeight
        };

        return {
          ...candidate,
          index,
          overflow: computeViewportOverflow(panelRect),
          overlap: computeOverlapArea(panelRect, rect)
        };
      })
      .sort((a, b) => {
        if (a.overflow !== b.overflow) {
          return a.overflow - b.overflow;
        }

        if (a.overlap !== b.overlap) {
          return a.overlap - b.overlap;
        }

        return a.index - b.index;
      });

    const best = ranked[0];
    return {
      top: window.scrollY + best.top,
      left: window.scrollX + best.left,
      name: best.name
    };
  }

  function computeViewportOverflow(rect) {
    return (
      Math.max(0, 12 - rect.left) +
      Math.max(0, rect.right - (window.innerWidth - 12)) +
      Math.max(0, 12 - rect.top) +
      Math.max(0, rect.bottom - (window.innerHeight - 12))
    );
  }

  function computeOverlapArea(panelRect, targetRect) {
    const overlapWidth =
      Math.min(panelRect.right, targetRect.right) - Math.max(panelRect.left, targetRect.left);
    const overlapHeight =
      Math.min(panelRect.bottom, targetRect.bottom) - Math.max(panelRect.top, targetRect.top);

    if (overlapWidth <= 0 || overlapHeight <= 0) {
      return 0;
    }

    return overlapWidth * overlapHeight;
  }

  function handleDragStart(event) {
    if (getDisplayMode() === "sidebar" || event.button !== 0) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    state.drag.active = true;
    state.drag.offsetX = event.clientX - panelRect.left;
    state.drag.offsetY = event.clientY - panelRect.top;
    panel.dataset.dragging = "true";
    event.preventDefault();
  }

  function handleDragMove(event) {
    if (!state.drag.active) {
      return;
    }

    const panelWidth = panel.offsetWidth || 360;
    const panelHeight = panel.offsetHeight || 280;
    const viewportLeft = clamp(
      event.clientX - state.drag.offsetX,
      12,
      Math.max(12, window.innerWidth - panelWidth - 12)
    );
    const viewportTop = clamp(
      event.clientY - state.drag.offsetY,
      12,
      Math.max(12, window.innerHeight - panelHeight - 12)
    );

    panel.style.left = `${window.scrollX + viewportLeft}px`;
    panel.style.top = `${window.scrollY + viewportTop}px`;
    panel.hidden = false;
    panel.style.visibility = "";
    event.preventDefault();
  }

  function handleDragEnd() {
    if (!state.drag.active) {
      return;
    }

    state.drag.active = false;
    panel.dataset.dragging = "false";
  }

  function resolveAnchorPoint(event, rect) {
    if (event instanceof MouseEvent) {
      return {
        clientX: event.clientX,
        clientY: event.clientY
      };
    }

    if (rect) {
      return {
        clientX: rect.right,
        clientY: rect.bottom
      };
    }

    return null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createRoot() {
    const rootNode = document.createElement("div");
    rootNode.id = "__edge_translate_root__";
    rootNode.dataset.loading = "false";
    return rootNode;
  }

  function createTriggerButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.id = "__edge_translate_trigger__";
    button.hidden = true;
    button.textContent = "译";
    button.title = "翻译选中文本";
    return button;
  }

  function createPanel() {
    const node = document.createElement("section");
    node.id = "__edge_translate_panel__";
    node.hidden = true;
    node.dataset.state = "idle";
    node.dataset.dragging = "false";
    node.dataset.pinned = "false";
    node.dataset.displayMode = "floating";
    node.innerHTML = `
      <header class="__edge_translate_header__">
        <strong>划词翻译</strong>
        <button type="button" class="__edge_translate_pin__" data-action="pin">固定</button>
      </header>
      <div class="__edge_translate_body__">
        <div class="__edge_translate_status__" data-role="status"></div>
        <div class="__edge_translate_result__" data-role="translation"></div>
        <div class="__edge_translate_meta__" data-role="meta"></div>
      </div>
      <footer class="__edge_translate_footer__">
        <button type="button" data-action="copy">复制结果</button>
        <button type="button" data-action="copy-original">复制原文</button>
        <button type="button" data-action="settings">打开设置</button>
      </footer>
    `;
    return node;
  }
})();
