// Mock of an OpenAI-compatible API endpoint (like https://chat-ai.academiccloud.de/v1)
// for demonstrating the Chat AI web interface without real models.
//
// Endpoints:
//   GET  /v1/models                 model catalog (GWDG format)
//   POST /v1/chat/completions       streamed (SSE) or plain completions, simulated tools
//   POST /v1/audio/speech           "text to speech" (one tone per word, WAV)
//   POST /v1/documents/convert/file "Docling" document conversion to Markdown
//   POST /v1/embeddings             deterministic pseudo-embeddings
//
// No dependencies: run with `node server.mjs`.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { CHAT_MODELS, EMBEDDING_MODELS, ALL_MODELS, publicModel } from "./catalog.mjs";
import { STREAM_DELAY, analyze, respond, isTitleRequest, makeTitle, isMemoryRequest, makeMemory } from "./models.mjs";
import { makeSpeechWav, makePromptSvg, parseMultipart, extractPdfText } from "./media.mjs";

const PORT = Number(process.env.MOCK_PORT || 8090);
const MAX_BODY = 60 * 1024 * 1024;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = () => Math.floor(Date.now() / 1000);
const estimateTokens = (text) => Math.max(1, Math.ceil(text.length / 4));
const short = (s, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), "[mock]", ...args);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Request body too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message, type, code = null) {
  // x-should-retry stops OpenAI SDK clients from retrying simulated failures.
  sendJson(res, status, { error: { message, type, code } }, { "x-should-retry": "false" });
}

// ---------------------------------------------------------------------------
// Simulated server-side tools. The back service turns the UI's tool switches
// into these types (see back/service.mjs); the UI renders the "*.event"
// tool calls as progress lines in the thinking block.
// ---------------------------------------------------------------------------

function simulateTools(ctx) {
  const steps = []; // { delta } chunks streamed before the answer
  let note = "";
  let references = ""; // rendered by the web interface as "Quellen und Referenzen"
  const has = (type) => ctx.tools.includes(type);
  const event = (name, args) =>
    steps.push({
      delta: { tool_calls: [{ index: 0, id: "call_" + randomUUID().slice(0, 8), type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    });
  const query = short(ctx.text.replace(/\s+/g, " "), 80);
  const wantsImage = has("image_generation") && /bild|grafik|logo|zeichne|male|illustr|image|picture|draw|foto|poster/i.test(ctx.text);
  const wantsAudio = has("audio_generation") && /audio|musik|song|lied|ton|klang|sound|vorles|sprich/i.test(ctx.text);

  if (has("web_search_preview") && query && !wantsImage && !wantsAudio) {
    event("websearch.event", { event: "begin", query });
    event("websearch.event", { event: "config", "search-engine": "Mock-Suche" });
    event("websearch.event", { event: "fetch", url: "https://example.org/mock-quelle-1" });
    event("websearch.event", { event: "fetch", url: "https://example.org/mock-quelle-2" });
    event("websearch.event", { event: "websearch_done", selected: 2 });
    note += `\n\n**Websuche (simuliert):** Gesucht wurde nach „${query}“. Die Quellen unten sind Platzhalter.`;
    references =
      `[RREF1] [Mock-Quelle 1: Überblick zu „${short(query, 40)}“](https://example.org/mock-quelle-1)\n` +
      "Simulierter Auszug: So würde ChatAI einen gefundenen Textabschnitt aus der ersten Quelle anzeigen.\n" +
      "[RREF2] [Mock-Quelle 2: Hintergrund und Details](https://example.org/mock-quelle-2)\n" +
      "Simulierter Auszug: Jede Quelle lässt sich aufklappen, kopieren und im Browser öffnen.";
  }
  if (ctx.body.arcana?.id) {
    event("arcana.event", { event: "accessing", arcana: ctx.body.arcana.id });
    event("arcana.event", { event: "done" });
    note += "\n\n**Arcana (simuliert):** Die Wissensbasis wurde „durchsucht“ – im Mock ohne echte Dokumente.";
  }
  if (Array.isArray(ctx.body["mcp-servers"]) && ctx.body["mcp-servers"].length) {
    event("mcp.event", { event: "call", server: "mock-mcp", function: "lookup", arguments: JSON.stringify({ q: query }) });
    event("mcp.event", { event: "result", type: "text" });
    note += "\n\n**MCP (simuliert):** Ein MCP-Server wurde aufgerufen.";
  }
  if (wantsImage) {
    event("image.event", { event: "image_creation_begin", query });
    const svg = makePromptSvg(ctx.text);
    steps.push({ delta: { content: { type: "image", image_url: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64") } } });
    event("image.event", { event: "done" });
    note += "\n\n**Bildgenerierung (simuliert):** Statt eines echten Bildmodells hat der Mock-Server eine SVG-Grafik mit deinem Prompt erzeugt.";
  }
  if (wantsAudio) {
    event("audio.event", { event: "audio_creation_begin", query });
    const wav = makeSpeechWav(ctx.text);
    steps.push({ delta: { audio: { data: wav.toString("base64"), format: "wav", filename: "mock-audio.wav" } } });
    event("audio.event", { event: "done" });
    note += "\n\n**Audiogenerierung (simuliert):** Pro Wort deines Prompts erklingt ein Ton.";
  }
  if (has("video_create") && /video|film|clip/i.test(ctx.text)) {
    event("video.event", { event: "begin", query });
    event("video.event", { event: "error", msg: "Videogenerierung ist im Mock nicht verfügbar." });
  }
  if (has("audio_transcription") && ctx.audio.length) {
    event("audio_transcription.event", { event: "begin" });
    event("audio_transcription.event", { event: "done", transcription: `(Mock-Transkript: ${ctx.audio.length} Audiodatei(en) empfangen)` });
  }
  // The web interface expects references last, after a line of dashes.
  if (references) note += `\n\n-----\nReferences:\n${references}`;
  return { steps, note };
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

function chunkOf(id, model, delta, finish_reason = null) {
  return { id, object: "chat.completion.chunk", created: now(), model, choices: [{ index: 0, delta, finish_reason }] };
}

async function chatCompletions(req, res) {
  let body;
  try {
    body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  } catch {
    return sendError(res, 400, "Invalid JSON body", "invalid_request_error");
  }
  const ctx = analyze(body);
  const model = ctx.model;
  const internal = isTitleRequest(ctx) ? "title" : isMemoryRequest(ctx) ? "memory" : null;

  log(
    `chat model=${body.model} stream=${!!body.stream} messages=${ctx.messages.length}`,
    `temp=${body.temperature} top_p=${body.top_p}`,
    ctx.images.length ? `images=${ctx.images.length}` : "",
    ctx.tools.length ? `tools=${ctx.tools.join(",")}` : "",
    internal ? `task=${internal}` : "",
    `auth=${req.headers.authorization ? "yes" : "no"}`,
  );

  if (!Array.isArray(body.messages)) return sendError(res, 422, "messages must be an array", "invalid_request_error");
  if (EMBEDDING_MODELS.some((m) => m.id === body.model)) {
    return sendError(res, 400, `'${body.model}' is an embedding model, use /v1/embeddings (mock).`, "invalid_request_error");
  }
  if (!model) return sendError(res, 404, `The model '${body.model}' does not exist (mock).`, "invalid_request_error", "model_not_found");
  if (model.status !== "ready") {
    return sendError(res, 503, `Das Modell '${model.id}' ist offline (simulierter Ausfall).`, "service_unavailable", "model_offline");
  }

  const tools = body.stream && !internal ? simulateTools(ctx) : { steps: [], note: "" };
  ctx.usedTools = tools.steps.length > 0;

  let reply;
  if (internal === "title") reply = { content: makeTitle(ctx) };
  else if (internal === "memory") reply = { content: JSON.stringify(makeMemory(ctx)) };
  else reply = respond(ctx);

  const content = reply.content + tools.note;
  const reasoning = reply.reasoning || "";
  const textOf = (m) =>
    typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.map((p) => p.text || "").join("\n") : "";
  const promptText = ctx.messages.map(textOf).join("\n");
  const usage = {
    prompt_tokens: estimateTokens(promptText) + ctx.images.length * 85,
    completion_tokens: estimateTokens(content + reasoning),
  };
  usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
  const id = "chatcmpl-mock-" + randomUUID().slice(0, 12);

  if (!body.stream) {
    return sendJson(res, 200, {
      id,
      object: "chat.completion",
      created: now(),
      model: model.id,
      choices: [{ index: 0, message: { role: "assistant", content, ...(reasoning && { reasoning }) }, finish_reason: "stop" }],
      usage,
    });
  }

  // Server-Sent Events, the same wire format vLLM / OpenAI use.
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
  let closed = false;
  res.on("close", () => (closed = true));
  const send = (obj) => !closed && res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const delay = STREAM_DELAY[model.id] ?? STREAM_DELAY.default;
  const tokens = (text) => text.match(/\S+\s*|\s+/g) || [];

  send(chunkOf(id, model.id, { role: "assistant", content: "" }));
  for (const step of tools.steps) {
    if (closed) break;
    await sleep(350);
    send(chunkOf(id, model.id, step.delta));
  }
  for (const token of tokens(reasoning)) {
    if (closed) break;
    await sleep(delay);
    send(chunkOf(id, model.id, { reasoning: token }));
  }
  for (const token of tokens(content)) {
    if (closed) break;
    await sleep(delay);
    send(chunkOf(id, model.id, { content: token }));
  }
  if (closed) return log("client aborted the stream");
  send(chunkOf(id, model.id, {}, "stop"));
  send({ id, object: "chat.completion.chunk", created: now(), model: model.id, choices: [], usage });
  res.end("data: [DONE]\n\n");
}

// ---------------------------------------------------------------------------
// Speech and documents
// ---------------------------------------------------------------------------

async function speech(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  log(`speech model=${body.model} voice=${body.voice} chars=${(body.input || "").length}`);
  const wav = makeSpeechWav(body.input || "");
  res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": wav.length });
  res.end(wav);
}

async function convertDocument(req, res) {
  const parts = parseMultipart(await readBody(req), req.headers["content-type"]);
  const file = parts.find((p) => p.filename);
  if (!file) return sendError(res, 422, "No file provided", "invalid_request_error");
  log(`document file=${file.filename} type=${file.contentType} size=${file.data.length}`);

  const sizeKb = (file.data.length / 1024).toFixed(1).replace(".", ",");
  let body;
  if (file.contentType === "application/pdf" || file.filename.toLowerCase().endsWith(".pdf")) {
    const { pages, text } = extractPdfText(file.data);
    body = `- Seiten: ${pages || "unbekannt"}\n- Größe: ${sizeKb} KB\n\n## Extrahierter Text\n\n${
      text || "_Der Mock konnte keinen Text auslesen (z. B. eingebettete Schriften oder Scan). Eine echte Docling-Instanz kann das._"
    }`;
  } else {
    body = `- Typ: ${file.contentType}\n- Größe: ${sizeKb} KB\n\n## Inhalt\n\n${file.data.toString("utf8").slice(0, 8000)}`;
  }
  const md = `# ${file.filename}\n\n_Konvertiert vom Mock-Server (simuliert Docling)._\n\n${body}`;
  sendJson(res, 200, {
    document: { filename: file.filename, md_content: md, json_content: null, html_content: null, text_content: null, doctags_content: null },
    status: "success",
    errors: [],
    processing_time: 0.01,
    timings: {},
  });
}

// Deterministic pseudo-embeddings: same text, same unit vector.
async function embeddings(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const model = EMBEDDING_MODELS.find((m) => m.id === body.model);
  if (!model) return sendError(res, 404, `The embedding model '${body.model}' does not exist (mock).`, "invalid_request_error", "model_not_found");
  const inputs = Array.isArray(body.input) ? body.input : [body.input ?? ""];
  log(`embeddings model=${model.id} inputs=${inputs.length}`);
  const data = inputs.map((text, index) => {
    let seed = [...String(text)].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
    const vector = Array.from({ length: model.mock.dimensions }, () => {
      seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
      return seed / 2 ** 31 - 1;
    });
    const norm = Math.hypot(...vector) || 1;
    return { object: "embedding", index, embedding: vector.map((v) => Number((v / norm).toFixed(6))) };
  });
  const tokens = inputs.reduce((sum, text) => sum + estimateTokens(String(text)), 0);
  sendJson(res, 200, { object: "list", model: model.id, data, usage: { prompt_tokens: tokens, total_tokens: tokens } });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.writeHead(204).end();

  const path = new URL(req.url, "http://localhost").pathname.replace(/^\/v1/, "").replace(/\/$/, "") || "/";
  try {
    if (req.method === "GET" && path === "/models") {
      // The Chat AI back service identifies itself with "inference-portal";
      // it only gets chat models. Direct API clients also see embedding models.
      const fromWebInterface = !!req.headers["inference-portal"];
      const list = fromWebInterface ? CHAT_MODELS : ALL_MODELS;
      log(`models count=${list.length}${fromWebInterface ? " (web interface)" : ""}`);
      return sendJson(res, 200, { object: "list", data: list.map(publicModel) });
    }
    if (req.method === "POST" && path === "/chat/completions") return await chatCompletions(req, res);
    if (req.method === "POST" && path === "/audio/speech") return await speech(req, res);
    if (req.method === "POST" && path === "/documents/convert/file") return await convertDocument(req, res);
    if (req.method === "POST" && path === "/embeddings") return await embeddings(req, res);
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return sendJson(res, 200, {
        service: "Chat AI mock API",
        status: "ok",
        endpoints: ["GET /v1/models", "POST /v1/chat/completions", "POST /v1/audio/speech", "POST /v1/documents/convert/file", "POST /v1/embeddings"],
        models: ALL_MODELS.map((m) => m.id),
      });
    }
    sendError(res, 404, `Unknown endpoint ${req.method} ${req.url}`, "not_found");
  } catch (err) {
    log("error:", err.message);
    if (!res.headersSent) sendError(res, err.status || 500, err.message, "server_error");
    else res.end();
  }
});

server.listen(PORT, () => {
  log(`Chat AI mock API listening on http://localhost:${PORT}/v1 with ${CHAT_MODELS.length} chat and ${EMBEDDING_MODELS.length} embedding models`);
});
