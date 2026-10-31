// Simulated answers for the Chat AI demo.
//
// Every model from catalog.mjs answers under its own name and with its own
// capabilities: image/audio/video input, a visible thinking block, hidden
// reasoning (OpenAI), external hosting or code focus. Four demo models cover
// special cases (echo, markdown showcase, slow streaming, offline).
import { CHAT_MODELS, GROUP_LABELS } from "./catalog.mjs";
import { imageInfo, parseDataUrl } from "./media.mjs";

// Streaming speed in milliseconds per token.
export const STREAM_DELAY = { "mock-slow": 140, default: 12 };

// ---------------------------------------------------------------------------
// Request analysis
// ---------------------------------------------------------------------------

function partsOf(message) {
  if (typeof message?.content === "string") return [{ type: "text", text: message.content }];
  return Array.isArray(message?.content) ? message.content : [];
}

// Collects everything a responder may need from the request body.
export function analyze(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => partsOf(m).map((p) => p.text || "").join("\n"))
    .join("\n");
  const users = messages.filter((m) => m.role === "user");
  const lastParts = partsOf(users[users.length - 1]);
  // The typed prompt comes first; converted documents (PDF -> Markdown, text files)
  // follow as extra text parts, raw files as "file" parts.
  const textParts = lastParts.filter((p) => p.type === "text").map((p) => p.text || "");
  const text = (textParts[0] || "").trim();
  const docs = [...textParts.slice(1), ...lastParts.filter((p) => p.type === "file").map((p) => `[Datei: ${p.file?.filename || "unbenannt"}]`)];
  const images = lastParts
    .filter((p) => p.type === "image_url")
    .map((p) => parseDataUrl(p.image_url?.url))
    .filter(Boolean);
  const audio = lastParts
    .filter((p) => p.type === "input_audio")
    .map((p) => ({ format: p.input_audio?.format || "?", bytes: Buffer.from(p.input_audio?.data || "", "base64").length }));
  const videos = lastParts
    .filter((p) => p.type === "video_url")
    .map((p) => parseDataUrl(p.video_url?.url))
    .filter(Boolean);
  const memorySection = /--- Begin User Memory ---([\s\S]*?)--- End User Memory ---/.exec(system)?.[1] || "";
  const memories = memorySection
    .split("\n")
    .slice(1) // first block is the explanation sentence
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("The following list of memories"));
  const userPrompt = system
    .replace(/--- Begin (System Context|User Memory) ---[\s\S]*?--- End \1 ---/g, "")
    .trim();
  // The web interface sends reasoning settings as chat_template_kwargs (open-weight
  // models) and/or reasoning_effort (OpenAI, Claude, Mistral), see apis/chatCompletions.jsx.
  const kwargs = body.chat_template_kwargs || {};
  const effortSent = kwargs.enable_thinking !== undefined || kwargs.reasoning_effort || body.reasoning_effort;
  const effort = kwargs.enable_thinking === false ? "none" : body.reasoning_effort || kwargs.reasoning_effort || (kwargs.enable_thinking ? "on" : "medium");
  const tools = Array.isArray(body.tools) ? body.tools.map((t) => t.type) : [];
  const model = CHAT_MODELS.find((m) => m.id === body.model);
  return { body, model, messages, system, userPrompt, users, text, docs, images, audio, videos, memories, effort, effortSent, tools };
}

const nameFromMemory = (memories) =>
  memories.map((m) => /The user's name is ([^.]+)/i.exec(m)?.[1]).find(Boolean);

const quote = (s) => s.split("\n").map((l) => "> " + l).join("\n");
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const short = (s, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const kb = (bytes) => (bytes / 1024).toFixed(1).replace(".", ",") + " KB";
const has = (m, kind) => m.input.includes(kind);

// ---------------------------------------------------------------------------
// Internal tasks the web interface runs in the background
// ---------------------------------------------------------------------------

// Title generation (apis/generateTitle.jsx): first few words of the chat.
export function isTitleRequest(ctx) {
  return ctx.text.startsWith("Create a very short title");
}
export function makeTitle(ctx) {
  const first = ctx.users.map((m) => partsOf(m).find((p) => p.type === "text")?.text).find(Boolean) || "";
  const words = first.replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter(Boolean).slice(0, 4);
  if (!words.length) return "Neuer Chat";
  const title = words.join(" ");
  return title[0].toUpperCase() + title.slice(1);
}

// Memory generation (apis/generateMemory.jsx): picks up simple facts like
// "Ich heiße Anna" and answers in the JSON format the front end expects.
export function isMemoryRequest(ctx) {
  return ctx.text.includes("Determine whether the *new user message*");
}
export function makeMemory(ctx) {
  const message = /Here is the new user message:\s*"([\s\S]*?)"\s*Respond/.exec(ctx.text)?.[1] || "";
  const existing = [...ctx.text.matchAll(/^\s*(\d+)\. (.+)$/gm)].map((m) => ({ line: Number(m[1]), text: m[2] }));
  const rules = [
    [/(?:ich hei(?:ß|ss)e|mein name ist|my name is|nenn(?:t)? mich)\s+([\p{Lu}][\p{L}-]+)/iu, (v) => `The user's name is ${v}.`, "The user's name"],
    [/(?:ich wohne in|ich lebe in|i live in)\s+([\p{L} -]+?)(?:[.,!?]|$)/iu, (v) => `The user lives in ${v.trim()}.`, "The user lives"],
    [/(?:ich arbeite (?:bei|an|als)|i work (?:at|as))\s+([^.,!?]+)/iu, (v) => `The user works ${v.trim()}.`, "The user works"],
    [/(?:ich mag|ich liebe|i like|i love)\s+([^.,!?]+)/iu, (v) => `The user likes ${v.trim()}.`, null],
  ];
  for (const [re, toSentence, prefix] of rules) {
    const value = re.exec(message)?.[1];
    if (!value) continue;
    const sentence = toSentence(value);
    if (existing.some((e) => e.text === sentence)) break;
    const old = prefix && existing.find((e) => e.text.startsWith(prefix));
    return { store: true, memory_sentence: sentence, replace: !!old, line_number: old ? old.line : 0 };
  }
  return { store: false, memory_sentence: "", replace: false, line_number: 0 };
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const ARCHITECTURE = `## So fließt eine Nachricht durch ChatAI

1. **Browser (\`front/\`)** – React-App. Alle Gespräche liegen nur lokal im Browser (IndexedDB).
2. **Backend-Proxy (\`back/service.mjs\`)** – kleiner Express-Server. Er hält den API-Key serverseitig und leitet an \`/v1/chat/completions\` weiter.
3. **OpenAI-kompatibler Endpunkt** – in der Academic Cloud ist das das SAIA-Gateway der GWDG. Open-Weight-Modelle laufen per Slurm auf GPU-Knoten der GWDG, externe Modelle (OpenAI, Anthropic) werden weitergereicht. **In dieser Demo ist es der Mock-Server** (\`mock/server.mjs\`), der alle Antworten nur simuliert.
4. Die Antwort kommt als **Stream** (Server-Sent Events) zurück und erscheint Wort für Wort.

\`\`\`text
Browser :8080  ->  back :8081  ->  Mock-API :8090/v1               (Demo)
                              ->  chat-ai.academiccloud.de/v1     (Produktion)
\`\`\`

Um von der Demo auf echte Modelle umzustellen, reicht es, in \`back.json\` den \`apiEndpoint\` und einen gültigen \`apiKey\` einzutragen. Die Modell-IDs sind dieselben.`;

const HELP_TABLE = `| Stichwort | Was passiert |
|---|---|
| „Hallo“ | Begrüßung (mit Namen, falls das Gedächtnis aktiv ist) |
| „Wie funktioniert ChatAI?“ | Architektur und Datenfluss |
| „Modelle“ oder „Tabelle“ | Übersicht aller simulierten Modelle |
| „Code“ | Beispiel, wie man die API per Python oder curl nutzt |
| „Formel“ | LaTeX-Darstellung |
| „Ich heiße …“ | wird gespeichert, wenn in den Einstellungen das Gedächtnis aktiv ist |
| alles andere | ich zeige, welche Parameter ChatAI mitgeschickt hat |

Alle Modelle im Menü tragen die echten Namen und IDs aus der Academic Cloud und verhalten sich passend: z. B. *Qwen 3.8 27B* (Bilder, Thinking-Block), *GPT-5.5 (External)* (externes Modell, internes Reasoning), *Qwen 3 Coder Next* (Code), *Qwen 3 Omni* (Audio und Video). Dazu kommen *Demo: Langsam* zum Abbrechen und *Demo: Offline* für den Fehlerfall.`;

function capabilities(m) {
  return [
    has(m, "image") && "Bilder",
    has(m, "audio") && "Audio",
    has(m, "video") && "Video",
    m.mock.thinking === "visible" && "Thinking",
    m.mock.thinking === "hidden" && "Reasoning (intern)",
    m.external && "extern",
  ].filter(Boolean);
}

function modelFacts(m) {
  const facts = [
    `Anbieter: ${m.company}`,
    m.releaseDate && `Release: ${m.releaseDate}`,
    m.contextLength && `Kontext: ${m.contextLength} Token`,
    m.numParameters && `Parameter: ${m.numParameters}`,
    `Fähigkeiten: ${["Text", ...capabilities(m)].join(", ")}`,
    `Kategorie: ${GROUP_LABELS[m.mock.group]}`,
  ].filter(Boolean);
  return facts.map((f) => `- ${f}`).join("\n");
}

function modelOverview() {
  const order = ["gwdg", "external", "commercial", "other", "demo"];
  const sections = order.map((group) => {
    const rows = CHAT_MODELS.filter((m) => m.mock.group === group).map(
      (m) => `| ${m.name} | \`${m.id}\` | ${capabilities(m).join(", ") || "–"} |`,
    );
    return `**${GROUP_LABELS[group]}** (${rows.length})\n\n| Name | ID | Besonderheiten |\n|---|---|---|\n${rows.join("\n")}`;
  });
  return `Diese ${CHAT_MODELS.length} Modelle simuliert der Mock-Server (\`mock/catalog.mjs\`). Namen und IDs entsprechen der Academic Cloud.\n\n${sections.join("\n\n")}\n\nZusätzlich gibt es drei Embedding-Modelle, die wie bei der GWDG nur über die API erreichbar sind.`;
}

const code = (m) => `So spricht man dieselbe API an, die auch ChatAI nutzt – hier gegen den Mock-Server:

\`\`\`python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8090/v1",   # Produktion: https://chat-ai.academiccloud.de/v1
    api_key="mock",                         # Produktion: eigener API-Key
)

response = client.chat.completions.create(
    model="${m.id}",
    messages=[{"role": "user", "content": "Hallo!"}],
)
print(response.choices[0].message.content)
\`\`\`

Oder direkt mit \`curl\`:

\`\`\`bash
curl http://localhost:8090/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${m.id}", "messages": [{"role": "user", "content": "Test"}]}'
\`\`\`

Die Liste aller Modell-IDs liefert \`GET /v1/models\`.`;

const FORMULA = `Die **Temperatur** aus den Einstellungen steckt in dieser Formel. Ein Modell wählt das nächste Token $i$ mit der Wahrscheinlichkeit

$$
p_i = \\frac{e^{z_i / T}}{\\sum_j e^{z_j / T}}
$$

Dabei sind $z_i$ die Rohwerte (Logits) und $T$ die Temperatur:

- $T \\to 0$: fast immer das wahrscheinlichste Token – sachlich, wiederholbar
- $T = 1$: unverändertes Modellverhalten
- $T > 1$: flachere Verteilung – kreativer, aber unzuverlässiger

**top_p** schneidet zusätzlich den unwahrscheinlichen Rest ab: Es bleiben nur die Tokens, deren Wahrscheinlichkeiten zusammen $\\sum p_i \\le$ top_p ergeben.`;

function requestDetails(ctx) {
  const b = ctx.body;
  const m = ctx.model;
  const attachments = [
    ctx.images.length && `${ctx.images.length} Bild(er)`,
    ctx.docs.length && `${ctx.docs.length} Dokument(e)`,
    ctx.audio.length && `${ctx.audio.length} Audio`,
    ctx.videos.length && `${ctx.videos.length} Video(s)`,
  ].filter(Boolean);
  const rows = [
    ["Modell", `\`${b.model}\` (${m.name})`],
    ["Verarbeitung", m.external ? `extern bei ${m.company}` : "GWDG-Rechenzentrum"],
    ["Temperatur", b.temperature ?? "–"],
    ["top_p", b.top_p ?? "–"],
    ["Reasoning", ctx.effortSent ? ctx.effort : "–"],
    ["Nachrichten im Verlauf", `${ctx.messages.length} (davon ${ctx.users.length} von dir)`],
    ["Systemprompt", ctx.userPrompt ? `„${short(ctx.userPrompt)}“` : "–"],
    ["Anhänge", attachments.join(", ") || "–"],
    ["Tools", ctx.tools.filter((t) => t !== "audio_transcription").join(", ") || "aus"],
    ["Gedächtnis-Einträge", ctx.memories.length || "–"],
  ];
  return `| Parameter | Wert |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${cell(v)} |`).join("\n")}`;
}

function documentAnswer(ctx) {
  const doc = ctx.docs[0];
  const title = /^#\s+(.+)$/m.exec(doc)?.[1];
  const body = doc.replace(/^#.*$/gm, "").replace(/^_.*_$/gm, "").replace(/^- .*$/gm, "").replace(/\s+/g, " ").trim();
  return `Du hast **${ctx.docs.length} Dokument(e)** mitgeschickt${title ? ` – das erste heißt \`${title}\`` : ""} (${doc.length} Zeichen).\n\nSo kommt ein Dokument zu mir: Mit **Process** lädt ChatAI die Datei an \`/documents/convert/file\` hoch. In der Academic Cloud wandelt **Docling** sie in Markdown um, hier übernimmt das der Mock-Server. Der Text wird dann als zusätzlicher Textteil an deine Nachricht gehängt.\n\n**Anfang des Dokuments:**\n\n${quote(short(body || doc, 400))}\n\nDas echte Modell *${ctx.model.name}* würde jetzt „${short(ctx.text || "deine Frage", 80)}“ zum Inhalt beantworten.`;
}

function imageAnswer(ctx) {
  const m = ctx.model;
  if (!has(m, "image")) {
    return `Du hast ${ctx.images.length} Bild(er) angehängt, aber *${m.name}* verarbeitet keine Bilder. Wähle ein Modell mit Bild-Symbol, z. B. *Qwen 3.8 27B* oder *Gemma 4 31B Instruct*.`;
  }
  const rows = ctx.images.map((img, i) => {
    const info = imageInfo(img.buffer, img.mime);
    const size = info.width && info.height ? `${info.width} × ${info.height} px` : "unbekannt";
    return `| ${i + 1} | ${info.format} | ${kb(img.buffer.length)} | ${size} |`;
  });
  return `Ich habe **${ctx.images.length} Bild(er)** erhalten. ChatAI schickt sie als Base64-Daten-URL im Feld \`image_url\` mit:\n\n| # | Format | Größe | Auflösung |\n|---|---|---:|---|\n${rows.join("\n")}\n\n${ctx.text ? `Deine Frage dazu: „${short(ctx.text, 120)}“\n\n` : ""}Das echte *${m.name}* würde jetzt den Bildinhalt beschreiben. Der Mock liest nur die Dateiköpfe aus.`;
}

function mediaAnswer(ctx) {
  const m = ctx.model;
  const rows = [
    ...ctx.audio.map((a, i) => `| Audio ${i + 1} | ${a.format} | ${kb(a.bytes)} | \`input_audio\` |`),
    ...ctx.videos.map((v, i) => `| Video ${i + 1} | ${v.mime} | ${kb(v.buffer.length)} | \`video_url\` |`),
  ];
  const supported = (ctx.audio.length === 0 || has(m, "audio")) && (ctx.videos.length === 0 || has(m, "video"));
  return `Ich habe folgende Medien erhalten:\n\n| Datei | Format | Größe | Feld in der Anfrage |\n|---|---|---:|---|\n${rows.join("\n")}\n\n${
    supported
      ? `Das echte *${m.name}* würde den Inhalt jetzt verstehen (z. B. Sprache transkribieren oder Szenen beschreiben). Der Mock bestätigt nur den Empfang.`
      : `*${m.name}* kann diese Medien nicht verarbeiten. Für Audio und Video eignet sich *Qwen 3 Omni 30B A3B Instruct*.`
  }`;
}

function coderAnswer(ctx) {
  const task = short(ctx.text || "deine Aufgabe", 100).replace(/"/g, "'");
  return `Simulierter Lösungsvorschlag von *${ctx.model.name}*:\n\n\`\`\`python\ndef loesung(eingabe):\n    """${task}\n\n    Platzhalter: Ein echtes Coding-Modell würde hier funktionierenden Code schreiben.\n    """\n    raise NotImplementedError("Mock-Antwort")\n\n\nif __name__ == "__main__":\n    print(loesung("Beispiel"))\n\`\`\`\n\nEchte Coding-Modelle wie dieses lassen sich laut GWDG auch in CLI- und IDE-Werkzeuge einbinden.`;
}

// Main answer text, independent of thinking.
function answer(ctx) {
  const m = ctx.model;
  const t = ctx.text.toLowerCase();
  const name = nameFromMemory(ctx.memories);

  if (ctx.docs.length) return documentAnswer(ctx);
  if (ctx.images.length) return imageAnswer(ctx);
  if (ctx.audio.length || ctx.videos.length) return mediaAnswer(ctx);

  if (/(ich hei(ß|ss)e|mein name ist|my name is)\s+\S+/i.test(ctx.text)) {
    return `Freut mich! ${
      name ? `Laut Gedächtnis heißt du **${name}**.` : "Ich merke mir das allerdings nur, wenn in den Einstellungen das **Gedächtnis (Memory)** auf „Learn“ steht."
    }\n\nIm Hintergrund schickt ChatAI deine Nachricht dafür an das Memory-Modell (\`memoryGenerationModel\` in \`front.json\`). Gespeicherte Fakten werden bei jeder neuen Anfrage an den Systemprompt angehängt – schreib danach einfach „Hallo“.`;
  }
  if (/^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend)|hello)\b/.test(t)) {
    return `Hallo${name ? ` ${name}` : ""}! Hier antwortet **${m.name}** – allerdings nur als Simulation: Der Mock-Server verwendet den echten Namen und die echten Eigenschaften, rechnet aber kein KI-Modell.${
      name ? `\n\nDeinen Namen kenne ich aus dem **Gedächtnis**: ChatAI hat ihn an den Systemprompt angehängt.` : ""
    }\n\n${modelFacts(m)}\n\nDarauf reagiere ich:\n\n${HELP_TABLE}`;
  }
  if (/hilfe|help|was kannst du|wer bist du/.test(t)) {
    return `Ich simuliere **${m.name}** – kein echtes KI-Modell, sondern ein kleines Regelwerk im Mock-Server.\n\n${modelFacts(m)}\n\nDarauf reagiere ich:\n\n${HELP_TABLE}`;
  }
  if (/wie funktioniert|architektur|ablauf|datenfluss|how does/.test(t)) return ARCHITECTURE;
  if (/tabelle|table|modelle|übersicht|models/.test(t)) return modelOverview();
  if (/\bcode\b|python|curl|\bapi\b|programm/.test(t) && m.id !== "qwen3-coder-next") return code(m);
  if (/formel|latex|mathe|temperatur|formula/.test(t)) return FORMULA;

  if (ctx.usedTools) {
    return "Für deine Anfrage habe ich die aktivierten **GWDG-Tools** genutzt – alles simuliert. Die einzelnen Schritte stehen im aufklappbaren Block über dieser Antwort.";
  }
  if (m.id === "qwen3-coder-next") return coderAnswer(ctx);
  return `Du hast geschrieben:\n\n${quote(ctx.text || "(leere Nachricht)")}\n\nIch simuliere *${m.name}* und verstehe den Inhalt nicht wirklich. Dafür zeige ich dir, was ChatAI mitgeschickt hat:\n\n${requestDetails(ctx)}\n\nTipp: Schreib **„Hilfe“**, um zu sehen, worauf ich reagiere.`;
}

const STEPS_PER_EFFORT = { none: 0, minimal: 1, low: 2, on: 4, medium: 4, high: 6, xhigh: 7, max: 8 };

function thinking(ctx, count) {
  const q = ctx.text || "(leere Nachricht)";
  const words = q.split(/\s+/).filter(Boolean).length;
  const steps = [
    `Die Frage lautet: „${short(q, 120)}“.`,
    `Sie hat ${words} Wörter und ${q.length} Zeichen.`,
    /\?$/.test(q.trim()) ? "Es ist eine direkte Frage, also antworte ich konkret." : "Es ist keine direkte Frage, eher eine Aussage oder ein Auftrag.",
    `Der Verlauf hat ${ctx.messages.length} Nachrichten, ich beziehe die letzte Nachricht ein.`,
    ctx.images.length ? `Es sind ${ctx.images.length} Bild(er) angehängt, die ich einbeziehe.` : "Es sind keine Bilder angehängt.",
    "Ich prüfe, ob es Fakten gibt, die ich nicht kenne – als Mock kenne ich keine, also bleibe ich ehrlich.",
    "Ich gliedere die Antwort in eine kurze Zusammenfassung und eine Erklärung des Mechanismus.",
    "Zum Schluss prüfe ich, ob die Antwort zur gewählten Denk-Stufe passt.",
  ];
  return steps.slice(0, count).map((s, i) => `Schritt ${i + 1}: ${s}`).join("\n\n");
}

// Short note on how reasoning was handled, appended to the answer.
function reasoningNote(ctx, count) {
  const m = ctx.model;
  if (m.mock.thinking === "visible") {
    if (count === 0) return `\n\n_Thinking ist ausgeschaltet (Stufe „none“). Einschalten über das Regler-Symbol → Reasoning._`;
    return `\n\n_Denk-Stufe „${ctx.effort}“: Der Denkprozess wurde als \`delta.reasoning\` gestreamt und steht im aufklappbaren Block. Die Stufen kommen aus \`front/src/config/models/${m.id}.json\`._`;
  }
  if (m.mock.thinking === "hidden" && ctx.effortSent) {
    return ctx.effort === "none"
      ? `\n\n_Reasoning ist ausgeschaltet (Stufe „none“)._`
      : `\n\n_${m.company}-Modelle denken intern (hier: Stufe „${ctx.effort}“), der Denkprozess wird in ChatAI nicht angezeigt._`;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Demo models
// ---------------------------------------------------------------------------

const SHOWCASE = `# Markdown-Showcase

ChatAI rendert Antworten als **Markdown** – mit *Kursiv*, \`Inline-Code\`, [Links](https://docs.hpc.gwdg.de/services/ai-services/chat-ai/) und mehr.

## Tabelle

| Funktion | Wo im Code | Status |
|---|---|:---:|
| Streaming | \`front/src/apis/chatCompletions.jsx\` | ✓ |
| Thinking-Block | \`ThinkingBlock.jsx\` | ✓ |
| Formeln | KaTeX | ✓ |

## Code mit Syntax-Highlighting

\`\`\`javascript
// Liest einen Server-Sent-Events-Stream
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}
\`\`\`

## Formeln

Inline: $E = mc^2$ und als Block:

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Listen

1. Nummeriert
2. Mit Unterpunkten
   - eins
   - zwei

> **Hinweis:** Rohes HTML wird aus Sicherheitsgründen nicht gerendert.

---

Jede Nachricht lässt sich übrigens kopieren, bearbeiten oder neu generieren.`;

const SLOW = `Diese Antwort kommt absichtlich langsam, Wort für Wort. So sieht man gut, wie Streaming funktioniert: Der Server schickt die Antwort nicht am Stück, sondern in vielen kleinen Teilen als Server-Sent Events. Jedes Teil ist ein kleines JSON-Objekt mit dem nächsten Textstück im Feld delta.content. ChatAI hängt die Stücke sofort an die Nachricht an, deshalb kann man schon mitlesen, während das Modell noch rechnet. Auf großen Rechenclustern wie dem der GWDG kann es bei hoher Last etwas dauern, bis das erste Wort kommt – die Balken neben dem Modellnamen zeigen die aktuelle Auslastung. Tipp: Tippe jetzt auf den Stopp-Button. ChatAI bricht die Anfrage dann ab und behält den Text, der bis dahin angekommen ist.`;

function echo(ctx) {
  const extra = [
    ctx.images.length && `[${ctx.images.length} Bild(er) angehängt]`,
    ctx.docs.length && `[${ctx.docs.length} Dokument(e) angehängt]`,
  ].filter(Boolean).map((n) => "\n\n" + n).join("");
  return { content: (ctx.text || "(leere Nachricht)") + extra };
}

const DEMO_RESPONDERS = {
  "mock-echo": echo,
  "mock-showcase": () => ({ content: SHOWCASE }),
  "mock-slow": () => ({ content: SLOW }),
};

// Returns { content, reasoning? } for a chat request.
export function respond(ctx) {
  const demo = DEMO_RESPONDERS[ctx.model.id];
  if (demo) return demo(ctx);
  const count = ctx.model.mock.thinking === "visible" ? STEPS_PER_EFFORT[ctx.effort] ?? 4 : 0;
  return {
    reasoning: count ? thinking(ctx, count) : "",
    content: answer(ctx) + reasoningNote(ctx, count),
  };
}
