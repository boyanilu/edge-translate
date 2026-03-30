const OpenAI = require("./vendor/openai");

const inputText =
  process.argv[2] ||
  "On March 28, 1959, Xizang launched the democratic reform, freeing about 1 million serfs.";
const targetLang = process.argv[3] || "Chinese";

const apiKey = process.env.DASHSCOPE_API_KEY;
const baseURL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const model = process.env.DASHSCOPE_MODEL || "qwen-mt-flash";

if (!apiKey) {
  console.error("Missing DASHSCOPE_API_KEY environment variable.");
  console.error(
    "Example: $env:DASHSCOPE_API_KEY='sk-xxx'; node .\\test-qwen-mt-flash.js \"Hello world\" Chinese"
  );
  process.exit(1);
}

async function main() {
  const client = new OpenAI({
    apiKey,
    baseURL
  });

  console.log("[test] request text:", JSON.stringify(inputText));
  console.log("[test] target language:", targetLang);
  console.log("[test] base URL:", baseURL);
  console.log("[test] model:", model);

  const completion = await client.chat.completions.create({
    model,
    translation_options: {
      source_lang: "auto",
      target_lang: targetLang
    },
    messages: [
      {
        role: "user",
        content: inputText
      }
    ]
  });

  const content = completion?.choices?.[0]?.message?.content;
  const translatedText = Array.isArray(content)
    ? content
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
        .trim()
    : String(content || "").trim();

  console.log("[test] raw response:");
  console.log(JSON.stringify(completion, null, 2));
  console.log("[test] translated text:");
  console.log(translatedText);
}

main().catch((error) => {
  console.error("[test] request failed:");
  console.error(error);
  process.exit(1);
});
