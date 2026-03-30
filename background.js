import OpenAI from "./vendor/openai/index.mjs";

const DEFAULT_SETTINGS = {
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "",
  model: "qwen-mt-flash",
  targetLang: "Chinese"
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["settings"], ({ settings }) => {
    if (settings) {
      return;
    }

    chrome.storage.local.set({
      settings: DEFAULT_SETTINGS
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "translate") {
    handleTranslate(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "test-connection") {
    handleTranslate({
      text: message.payload?.text || "翻译成英文：我看到这个视频后没有笑"
    })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "open-options") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }

  return false;
});

async function handleTranslate(payload) {
  const text = (payload?.text || "").trim();
  if (!text) {
    throw new Error("没有检测到可翻译的文本。");
  }

  const settings = await loadSettings();
  validateSettings(settings);

  const client = createOpenAIClient(settings);
  console.log("[edge-translate:bg] translate request text:", JSON.stringify(text));
  console.log("[edge-translate:bg] translate target language:", settings.targetLang || DEFAULT_SETTINGS.targetLang);
  const completion = await client.chat.completions.create({
    model: settings.model,
    translation_options: {
      source_lang: "auto",
      target_lang: settings.targetLang || DEFAULT_SETTINGS.targetLang
    },
    messages: [
      {
        role: "user",
        content: text
      }
    ]
  });

  const translatedText = extractTranslatedText(completion);
  console.log("[edge-translate:bg] translate result:", JSON.stringify(translatedText));
  if (!translatedText) {
    throw new Error("模型返回成功，但没有解析到翻译结果。");
  }

  return {
    translatedText,
    model: settings.model
  };
}

async function loadSettings() {
  const { settings } = await chrome.storage.local.get(["settings"]);
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {})
  };
}

function createOpenAIClient(settings) {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: normalizeBaseURL(settings.baseURL || settings.apiUrl || ""),
    dangerouslyAllowBrowser: true,
    maxRetries: 1
  });
}

function validateSettings(settings) {
  if (!settings.baseURL && !settings.apiUrl) {
    throw new Error("请先在设置页填写 Base URL。");
  }

  if (!settings.apiKey) {
    throw new Error("请先在设置页填写 API Key。");
  }

  if (!settings.model) {
    throw new Error("请先在设置页填写模型名称。");
  }
}

function normalizeBaseURL(input) {
  return input.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

function extractTranslatedText(completion) {
  const messageContent = completion?.choices?.[0]?.message?.content;

  if (typeof messageContent === "string") {
    return messageContent.trim();
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item?.type === "text" && typeof item.text === "string") {
          return item.text;
        }

        if (item?.type === "output_text" && typeof item.text === "string") {
          return item.text;
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}
