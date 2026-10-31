// Model catalog of the mock API.
//
// IDs and names follow the real Chat AI / SAIA offering (as of 2026-10-31):
//   - GWDG docs "Available Models" and "SAIA" (API model names):
//     https://docs.hpc.gwdg.de/services/ai-services/chat-ai/models/
//     https://docs.hpc.gwdg.de/services/ai-services/saia/
//   - model configs in front/src/config/models/*.json (reasoning settings per ID)
//   - gwdg/saia-hub secrets/openai_config.json.sample (IDs of older OpenAI models)
// Release date, context and parameters come from the GWDG docs where given and
// stay empty otherwise. Context uses "k" throughout and parameters whole numbers,
// because the model selector sorts by the digits in these strings.
//
// Fields read by the web interface: id, name, input, output, status, demand,
// company, releaseDate, contextLength, numParameters, description, external.
// "External" in the name triggers the data-safety warning and disables tools.
// The `mock` block is internal and stripped from GET /v1/models.

const created = (date) => Math.floor(Date.parse(date || "2026-10-31") / 1000);

function model(id, name, company, family, opts = {}) {
  const {
    release = "",
    context = "",
    params = "",
    input = ["text"],
    thinking = null, // "visible" (thinking block) | "hidden" (provider keeps it internal)
    external = false,
    group,
    status = "ready",
    demand = 0,
    description = "",
    type = "chat",
    dimensions,
  } = opts;
  return {
    id,
    object: "model",
    owned_by: company,
    created: created(release),
    name,
    company,
    modelFamily: family,
    releaseDate: release,
    contextLength: context,
    numParameters: params,
    input,
    output: thinking === "visible" ? ["text", "thought"] : type === "embedding" ? ["embedding"] : ["text"],
    status,
    demand,
    external,
    description: description ? `Simuliert – ${description}` : "Simuliert.",
    mock: { group, thinking, type, dimensions },
  };
}

const TEXT_IMAGE = ["text", "image"];
const GWDG = { group: "gwdg" };
const EXT = { group: "external", external: true, input: TEXT_IMAGE };
const COMMERCIAL = { group: "commercial", external: true, input: TEXT_IMAGE };

export const CHAT_MODELS = [
  // --- Open-weight models hosted by GWDG (Chat AI model list) ---------------
  model("deepseek-v4-flash-0731", "DeepSeek V4 Flash 0731", "DeepSeek", "DeepSeek V4", {
    ...GWDG, release: "2026-07", context: "1000k", params: "304B", thinking: "visible",
    description: "MoE-Modell mit 304 Mrd. Parametern und 1 Mio. Token Kontext, laut GWDG gut für agentische Workflows. Die GWDG weist auf mögliche politische Zensur hin.",
  }),
  model("gemma-4-31b-it", "Gemma 4 31B Instruct", "Google", "Gemma 4", {
    ...GWDG, release: "2026-04", context: "256k", params: "31B", input: TEXT_IMAGE, thinking: "visible",
    description: "Vision-Modell mit starker Gesamtleistung für Reasoning, Agenten, Code und multimodale Aufgaben.",
  }),
  model("glm-5.3-flash", "GLM 5.3 Flash", "Z.ai", "GLM 5", {
    ...GWDG, release: "2026-02", context: "1000k", params: "320B", input: TEXT_IMAGE, thinking: "visible",
    description: "Nativ multimodales MoE-Modell (320 Mrd. Parameter, 18 Mrd. aktiv), stark bei Code und agentischen Aufgaben.",
  }),
  model("meta-llama-3.1-8b-instruct", "Meta Llama 3.1 8B Instruct", "Meta", "Llama 3.1", {
    ...GWDG, release: "2024-07", context: "128k", params: "8B",
    description: "Leichtes, sehr schnelles Standardmodell der GWDG für allgemeine Unterhaltungen.",
  }),
  model("qwen3-30b-a3b-instruct-2507", "Qwen 3 30B A3B Instruct 2507", "Alibaba Cloud", "Qwen 3", {
    ...GWDG, release: "2025-07", context: "256k", params: "30B",
    description: "Schnelles MoE-Modell (30,5 Mrd. Parameter, 3,3 Mrd. aktiv) ohne Thinking-Modus. Standardmodell dieser Demo.",
  }),
  model("qwen3-coder-next", "Qwen 3 Coder Next", "Alibaba Cloud", "Qwen 3 Coder", {
    ...GWDG, release: "2026-02", context: "256k", params: "80B",
    description: "Coding-Modell (80 Mrd. Parameter, 3 Mrd. aktiv), auch für CLI- und IDE-Integrationen.",
  }),
  model("qwen3-omni-30b-a3b-instruct", "Qwen 3 Omni 30B A3B Instruct", "Alibaba Cloud", "Qwen 3 Omni", {
    ...GWDG, release: "2025-09", context: "256k", params: "30B", input: ["text", "image", "audio", "video"],
    description: "Omni-Modell für Text, Bilder, Audio und Video.",
  }),
  model("qwen3.5-397b-a17b", "Qwen 3.5 397B A17B", "Alibaba Cloud", "Qwen 3.5", {
    ...GWDG, release: "2026-02", context: "256k", params: "397B", input: TEXT_IMAGE, thinking: "visible",
    description: "Eines der stärksten Open-Weight-Modelle (397 Mrd. Parameter, 17 Mrd. aktiv), mit Bildverständnis.",
  }),
  model("qwen3.6-35b-a3b", "Qwen 3.6 35B A3B", "Alibaba Cloud", "Qwen 3.6", {
    ...GWDG, release: "2026-04", context: "262k", params: "35B", input: TEXT_IMAGE, thinking: "visible",
    description: "Effizientes MoE-Modell (35 Mrd. Parameter, 3 Mrd. aktiv) für Code und agentische Workflows, mit Bildverständnis.",
  }),
  model("qwen3.8-27b", "Qwen 3.8 27B", "Alibaba Cloud", "Qwen 3.8", {
    ...GWDG, release: "2026-08", context: "262k", params: "27B", input: ["text", "image", "video"], thinking: "visible",
    description: "Natives Vision-Language-Modell für Bilder und Videos mit flexibler Thinking-Steuerung.",
  }),

  // --- External models (Chat AI model list) ----------------------------------
  model("claude-sonnet-5", "Claude Sonnet 5 (External)", "Anthropic", "Claude Sonnet", {
    ...EXT, release: "2026-06", context: "1000k", thinking: "visible",
    description: "Agentisches Modell mit sehr guter Leistung. Wird extern bei Anthropic verarbeitet.",
  }),
  model("claude-sonnet-4-6", "Claude Sonnet 4.6 (External)", "Anthropic", "Claude Sonnet", {
    ...EXT, release: "2026-02", context: "1000k", thinking: "visible",
    description: "Ausgewogen zwischen Leistung und Geschwindigkeit. Wird extern bei Anthropic verarbeitet.",
  }),
  model("openai-gpt5.6-sol", "GPT-5.6 Sol (External)", "OpenAI", "GPT-5.6", {
    ...EXT, release: "2026-07", context: "1050k", thinking: "hidden",
    description: "Spitzenmodell der GPT-5.6-Familie für komplexe professionelle Arbeit.",
  }),
  model("openai-gpt5.6-terra", "GPT-5.6 Terra (External)", "OpenAI", "GPT-5.6", {
    ...EXT, release: "2026-07", context: "1050k", thinking: "hidden",
    description: "GPT-5.6-Modell mit Balance aus Intelligenz und Kosten.",
  }),
  model("openai-gpt5.6-luna", "GPT-5.6 Luna (External)", "OpenAI", "GPT-5.6", {
    ...EXT, release: "2026-07", context: "1050k", thinking: "hidden",
    description: "GPT-5.6-Modell für kostensensible Anwendungen.",
  }),
  model("openai-gpt5.5", "GPT-5.5 (External)", "OpenAI", "GPT-5.5", {
    ...EXT, release: "2026-04", context: "1000k", thinking: "hidden",
    description: "Für anspruchsvolle professionelle Arbeit, Code und Agenten mit vielen Tools.",
  }),
  model("openai-gpt5.4", "GPT-5.4 (External)", "OpenAI", "GPT-5.4", {
    ...EXT, release: "2026-03", context: "272k", thinking: "hidden",
    description: "Für Wissensarbeit, Dokumente, Tabellen, Code und Datenanalyse.",
  }),
  model("openai-gpt5.4-mini", "GPT-5.4 Mini (External)", "OpenAI", "GPT-5.4", {
    ...EXT, release: "2026-03", context: "272k", thinking: "hidden",
    description: "Leichte, günstigere Variante von GPT-5.4.",
  }),
  model("openai-gpt5.4-nano", "GPT-5.4 Nano (External)", "OpenAI", "GPT-5.4", {
    ...EXT, release: "2026-03", context: "272k", thinking: "hidden",
    description: "Stark optimierte Variante von GPT-5.4 für geringe Latenz.",
  }),
  model("openai-gpt5.2", "GPT-5.2 (External)", "OpenAI", "GPT-5", {
    ...EXT, release: "2025-12", context: "400k", thinking: "hidden",
    description: "Für logiklastige, mehrstufige Aufgaben.",
  }),
  model("openai-gpt5.1", "GPT-5.1 (External)", "OpenAI", "GPT-5", {
    ...EXT, release: "2025-11", context: "400k", thinking: "hidden",
    description: "Für logiklastige, mehrstufige Aufgaben.",
  }),
  model("openai-gpt5", "GPT-5 (External)", "OpenAI", "GPT-5", {
    ...EXT, release: "2025-08", context: "400k", thinking: "hidden",
    description: "Gute Gesamtleistung mit Reasoning.",
  }),
  model("openai-gpt5-mini", "GPT-5 Mini (External)", "OpenAI", "GPT-5", {
    ...EXT, release: "2025-08", context: "400k", thinking: "hidden",
    description: "Leichte, günstigere Variante von GPT-5.",
  }),
  model("openai-gpt5-nano", "GPT-5 Nano (External)", "OpenAI", "GPT-5", {
    ...EXT, release: "2025-08", context: "400k", thinking: "hidden",
    description: "Schnellste Variante von GPT-5.",
  }),
  model("openai-o3", "o3 (External)", "OpenAI", "o3", {
    ...EXT, release: "2025-04", context: "200k", thinking: "hidden",
    description: "Reasoning-Modell; der Denkprozess wird nicht angezeigt. Laut GWDG veraltet.",
  }),
  model("openai-o3-mini", "o3-mini (External)", "OpenAI", "o3", {
    ...EXT, input: ["text"], release: "2025-01", context: "200k", thinking: "hidden",
    description: "Günstigere Variante von o3. Laut GWDG veraltet.",
  }),
  model("openai-gpt41", "GPT-4.1 (External)", "OpenAI", "GPT-4.1", {
    ...EXT, release: "2025-04", context: "1000k",
    description: "Verbesserte GPT-4-Generation mit 1 Mio. Token Kontext. Laut GWDG veraltet.",
  }),
  model("openai-gpt41-mini", "GPT-4.1 Mini (External)", "OpenAI", "GPT-4.1", {
    ...EXT, release: "2025-04", context: "1000k",
    description: "Schnellere, günstigere Variante von GPT-4.1. Laut GWDG veraltet.",
  }),
  model("openai-o1", "o1 (External)", "OpenAI", "o1", {
    ...EXT, release: "2024-12", context: "200k", thinking: "hidden",
    description: "Frühes Reasoning-Modell, laut GWDG durch o3 abgelöst und nicht mehr empfohlen.",
  }),
  model("openai-o1-mini", "o1 Mini (External)", "OpenAI", "o1", {
    ...EXT, input: ["text"], release: "2024-09", context: "128k", thinking: "hidden",
    description: "Kleine Variante von o1, laut GWDG nicht mehr empfohlen.",
  }),

  // --- Commercial portfolio and further models configured in the web interface
  model("openai-gpt6-sol", "GPT-6 Sol (External)", "OpenAI", "GPT-6", {
    ...COMMERCIAL, thinking: "hidden",
    description: "Teil des kommerziellen GWDG-Angebots (GPT-6-Familie), nur mit Freischaltung.",
  }),
  model("openai-gpt6-astra", "GPT-6 Astra (External)", "OpenAI", "GPT-6", {
    ...COMMERCIAL, thinking: "hidden",
    description: "Teil des kommerziellen GWDG-Angebots (GPT-6-Familie), nur mit Freischaltung.",
  }),
  model("openai-gpt6-luna", "GPT-6 Luna (External)", "OpenAI", "GPT-6", {
    ...COMMERCIAL, thinking: "hidden",
    description: "Teil des kommerziellen GWDG-Angebots (GPT-6-Familie), nur mit Freischaltung.",
  }),
  model("claude-opus-5-5", "Claude Opus 5.5 (External)", "Anthropic", "Claude Opus", {
    ...COMMERCIAL, thinking: "visible",
    description: "Claude-Opus-Modell, im Chat-AI-Code konfiguriert; kommerzielles Angebot, nur mit Freischaltung.",
  }),
  model("claude-opus-5", "Claude Opus 5 (External)", "Anthropic", "Claude Opus", {
    ...COMMERCIAL, thinking: "visible",
    description: "Teil des kommerziellen GWDG-Angebots (Claude Opus 5), nur mit Freischaltung.",
  }),
  model("claude-opus-4-8", "Claude Opus 4.8 (External)", "Anthropic", "Claude Opus", {
    ...COMMERCIAL, thinking: "visible",
    description: "Claude-Opus-Modell, im Chat-AI-Code konfiguriert; kommerzielles Angebot, nur mit Freischaltung.",
  }),
  model("claude-opus-4-7", "Claude Opus 4.7 (External)", "Anthropic", "Claude Opus", {
    ...COMMERCIAL, thinking: "visible",
    description: "Claude-Opus-Modell, im Chat-AI-Code konfiguriert; kommerzielles Angebot, nur mit Freischaltung.",
  }),
  model("claude-opus-4-6", "Claude Opus 4.6 (External)", "Anthropic", "Claude Opus", {
    ...COMMERCIAL, thinking: "visible",
    description: "Claude-Opus-Modell, im Chat-AI-Code konfiguriert; kommerzielles Angebot, nur mit Freischaltung.",
  }),
  model("claude-fable-5-1", "Claude Fable 5.1 (External)", "Anthropic", "Claude Fable", {
    ...COMMERCIAL, thinking: "visible",
    description: "Claude-Fable-Modell, im Chat-AI-Code konfiguriert; kommerzielles Angebot, nur mit Freischaltung.",
  }),
  model("claude-fable-5", "Claude Fable 5 (External)", "Anthropic", "Claude Fable", {
    ...COMMERCIAL, thinking: "visible",
    description: "Teil des kommerziellen GWDG-Angebots (Claude Fable 5), nur mit Freischaltung.",
  }),
  model("openai-o4-mini", "o4-mini (External)", "OpenAI", "o4", {
    ...COMMERCIAL, group: "other", release: "2025-04", context: "200k", thinking: "hidden",
    description: "Reasoning-Modell, im Chat-AI-Code konfiguriert, aktuell nicht in der GWDG-Modellliste.",
  }),
  model("openai-gpt-oss-120b", "GPT OSS 120B", "OpenAI", "GPT OSS", {
    group: "other", release: "2025-08", context: "128k", params: "117B", thinking: "visible",
    description: "Open-Weight-Modell von OpenAI, im Chat-AI-Code als internes Modell behandelt; aktuell nicht in der GWDG-Modellliste.",
  }),
  model("mistral-medium-3.5-128b", "Mistral Medium 3.5 128B", "Mistral AI", "Mistral Medium", {
    group: "other", params: "128B", thinking: "visible",
    description: "Im Chat-AI-Code konfiguriert, aktuell nicht in der GWDG-Modellliste.",
  }),
  model("glm-4.7", "GLM 4.7", "Z.ai", "GLM 4", {
    group: "other", thinking: "visible",
    description: "Vorgänger der GLM-5-Reihe, im Chat-AI-Code konfiguriert; aktuell nicht in der GWDG-Modellliste.",
  }),
  model("qwen3.5-122b-a10b", "Qwen 3.5 122B A10B", "Alibaba Cloud", "Qwen 3.5", {
    group: "other", params: "122B", input: TEXT_IMAGE, thinking: "visible",
    description: "Kleinere Qwen-3.5-Variante, im Chat-AI-Code konfiguriert; aktuell nicht in der GWDG-Modellliste.",
  }),

  // --- Demo models for special cases (not real models) -----------------------
  model("mock-echo", "Demo: Echo", "Demo", "Demo", {
    group: "demo", context: "8k", description: "Gibt die letzte Nachricht unverändert zurück – praktisch, um den Datenfluss zu prüfen.",
  }),
  model("mock-showcase", "Demo: Markdown-Showcase", "Demo", "Demo", {
    group: "demo", context: "8k", description: "Antwortet immer mit Tabellen, Code, Formeln, einem Mermaid-Diagramm, Listen und Zitaten.",
  }),
  model("mock-slow", "Demo: Langsam (hohe Last)", "Demo", "Demo", {
    group: "demo", context: "8k", demand: 5, description: "Streamt absichtlich langsam Wort für Wort – gut für den Stopp-Button.",
  }),
  model("mock-offline", "Demo: Offline", "Demo", "Demo", {
    group: "demo", context: "8k", status: "offline", description: "Nicht verfügbares Modell: Hinweis beim Auswählen, Fehler beim Senden.",
  }),
];

// Embedding models are API-only, like in SAIA. They are listed by GET /v1/models
// for direct API clients, but not for the Chat AI web interface.
export const EMBEDDING_MODELS = [
  model("e5-mistral-7b-instruct", "E5 Mistral 7B Instruct", "intfloat x Mistral", "E5", {
    group: "embedding", type: "embedding", dimensions: 4096, release: "2024-01", context: "4k", params: "7B",
    description: "Embedding-Modell (nur API).",
  }),
  model("multilingual-e5-large-instruct", "Multilingual E5 Large Instruct", "intfloat", "E5", {
    group: "embedding", type: "embedding", dimensions: 1024, description: "Mehrsprachiges Embedding-Modell (nur API).",
  }),
  model("qwen3-embedding-4b", "Qwen 3 Embedding 4B", "Alibaba Cloud", "Qwen 3 Embedding", {
    group: "embedding", type: "embedding", dimensions: 2560, params: "4B", description: "Embedding-Modell (nur API).",
  }),
];

export const ALL_MODELS = [...CHAT_MODELS, ...EMBEDDING_MODELS];

export const GROUP_LABELS = {
  gwdg: "Open-Weight, bei der GWDG gehostet",
  external: "Extern (OpenAI, Anthropic)",
  commercial: "Kommerzielles Angebot (nur mit Freischaltung)",
  other: "Im Chat-AI-Code konfiguriert, aktuell nicht in der GWDG-Liste",
  demo: "Demo-Modelle für Sonderfälle",
  embedding: "Embeddings (nur API)",
};

// Model entry as served by GET /v1/models (without the internal `mock` block).
export function publicModel({ mock, ...rest }) {
  return rest;
}
