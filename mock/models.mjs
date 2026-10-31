// Simulated models for the Chat AI demo.
//
// The catalog follows the format of the GWDG Chat AI /v1/models endpoint.
// The web interface reads:
//   input / output   -> capability icons (image input, "thought" = thinking)
//   status / demand  -> load indicator ("ready" | "offline", 0 = idle)
//   description etc. -> extended model selector (shown when present)
//   "External" in the name -> data-safety warning, tools disabled
import { imageInfo, parseDataUrl } from "./media.mjs";

const RELEASE = "2026-10-31";

const base = {
  object: "model",
  owned_by: "mock",
  created: Math.floor(Date.parse(RELEASE) / 1000),
  releaseDate: RELEASE,
  company: "Demo",
  modelFamily: "Mock",
  numParameters: "0",
  external: false,
  status: "ready",
  demand: 0,
  input: ["text"],
  output: ["text"],
};

export const MODELS = [
  {
    ...base,
    id: "mock-assistant",
    name: "Mock Assistent",
    contextLength: "32k",
    description:
      "Regelbasierter Demo-Assistent. Zeigt, was ChatAI an das Modell schickt, und reagiert auf Stichworte wie „Hilfe“, „Tabelle“, „Code“, „Formel“ oder „Wie funktioniert ChatAI?“.",
  },
  {
    ...base,
    id: "mock-reasoning",
    name: "Mock Reasoning",
    contextLength: "64k",
    output: ["text", "thought"],
    description:
      "Streamt zuerst einen simulierten Denkprozess (Thinking-Block) und dann die Antwort. Die Denk-Stufe lässt sich in den Einstellungen ändern.",
  },
  {
    ...base,
    id: "mock-vision",
    name: "Mock Vision",
    contextLength: "32k",
    input: ["text", "image"],
    description: "Nimmt Bilder entgegen und nennt technische Eckdaten wie Format, Dateigröße und Auflösung.",
  },
  {
    ...base,
    id: "mock-showcase",
    name: "Mock Markdown-Showcase",
    contextLength: "8k",
    description: "Antwortet immer mit einer Vorführung der Darstellung: Tabellen, Code, LaTeX-Formeln, Listen und Zitate.",
  },
  {
    ...base,
    id: "mock-echo",
    name: "Mock Echo",
    contextLength: "8k",
    description: "Gibt die letzte Nachricht unverändert zurück – praktisch, um den Datenfluss zu prüfen.",
  },
  {
    ...base,
    id: "mock-slow",
    name: "Mock Langsam (hohe Last)",
    contextLength: "16k",
    demand: 5,
    description: "Streamt absichtlich langsam Wort für Wort. Gut, um Streaming und den Stopp-Button zu zeigen.",
  },
  {
    ...base,
    id: "mock-cloud",
    name: "Mock Cloud (External)",
    contextLength: "128k",
    external: true,
    description:
      "Simuliert ein externes Cloud-Modell. ChatAI zeigt dafür einen Datenschutz-Hinweis und deaktiviert die Tools.",
  },
  {
    ...base,
    id: "mock-offline",
    name: "Mock Offline",
    contextLength: "32k",
    status: "offline",
    description: "Simuliert ein nicht verfügbares Modell. Anfragen schlagen mit einer Fehlermeldung fehl.",
  },
];

// Per-model streaming speed in milliseconds per token.
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
  const audio = lastParts.filter((p) => p.type === "input_audio");
  const memorySection = /--- Begin User Memory ---([\s\S]*?)--- End User Memory ---/.exec(system)?.[1] || "";
  const memories = memorySection
    .split("\n")
    .slice(1) // first block is the explanation sentence
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("The following list of memories"));
  const userPrompt = system
    .replace(/--- Begin (System Context|User Memory) ---[\s\S]*?--- End \1 ---/g, "")
    .trim();
  const kwargs = body.chat_template_kwargs || {};
  const effort = kwargs.enable_thinking === false ? "none" : kwargs.reasoning_effort || body.reasoning_effort || "medium";
  const tools = Array.isArray(body.tools) ? body.tools.map((t) => t.type) : [];
  return { body, messages, system, userPrompt, users, text, docs, images, audio, memories, effort, tools };
}

const nameFromMemory = (memories) =>
  memories.map((m) => /The user's name is ([^.]+)/i.exec(m)?.[1]).find(Boolean);

const quote = (s) => s.split("\n").map((l) => "> " + l).join("\n");
const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
const short = (s, n = 80) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const kb = (bytes) => (bytes / 1024).toFixed(1).replace(".", ",") + " KB";

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
// Responders: each returns { content, reasoning? }
// ---------------------------------------------------------------------------

const ARCHITECTURE = `## So fließt eine Nachricht durch ChatAI

1. **Browser (\`front/\`)** – React-App. Alle Gespräche liegen nur lokal im Browser (IndexedDB).
2. **Backend-Proxy (\`back/service.mjs\`)** – kleiner Express-Server. Er hält den API-Key serverseitig und leitet an \`/v1/chat/completions\` weiter.
3. **OpenAI-kompatibler Endpunkt** – in der Academic Cloud ist das das SAIA-Gateway der GWDG, das die Anfrage per Slurm an GPU-Knoten mit vLLM schickt. **In dieser Demo ist es der Mock-Server** (\`mock/server.mjs\`), der Antworten nur simuliert.
4. Die Antwort kommt als **Stream** (Server-Sent Events) zurück und erscheint Wort für Wort.

\`\`\`text
Browser :8080  ->  back :8081  ->  Mock-API :8090/v1               (Demo)
                              ->  chat-ai.academiccloud.de/v1     (Produktion)
\`\`\`

Um von der Demo auf echte Modelle umzustellen, reicht es, in \`back.json\` den \`apiEndpoint\` und einen gültigen \`apiKey\` einzutragen.`;

const HELP_TABLE = `| Stichwort | Was passiert |
|---|---|
| „Hallo“ | Begrüßung (mit Namen, falls das Gedächtnis aktiv ist) |
| „Wie funktioniert ChatAI?“ | Architektur und Datenfluss |
| „Tabelle“ | Vergleichstabelle aller Mock-Modelle |
| „Code“ | Beispiel, wie man die API per Python oder curl nutzt |
| „Formel“ | LaTeX-Darstellung |
| „Ich heiße …“ | wird gespeichert, wenn in den Einstellungen das Gedächtnis aktiv ist |
| alles andere | ich zeige, welche Parameter ChatAI mitgeschickt hat |

Weitere Ideen: oben ein anderes Modell wählen (*Mock Reasoning*, *Mock Vision* mit Bild-Upload, *Mock Langsam* zum Abbrechen), ein PDF anhängen, den Systemprompt in den Einstellungen ändern oder unter einer Antwort auf das Lautsprecher-Symbol tippen.`;

const HELP = `Ich bin ein **simuliertes Modell** – kein echtes KI-Modell, sondern ein kleines Regelwerk im Mock-Server. Darauf reagiere ich:\n\n${HELP_TABLE}`;

function modelTable() {
  const rows = MODELS.map((m) => {
    const caps = [m.input.includes("image") && "Bilder", m.output.includes("thought") && "Thinking", m.external && "extern"]
      .filter(Boolean)
      .join(", ");
    return `| \`${m.id}\` | ${m.name} | ${m.status === "ready" ? "bereit" : "offline"} | ${m.demand} | ${caps || "–"} |`;
  });
  return `Hier alle simulierten Modelle aus \`mock/models.mjs\`:\n\n| ID | Name | Status | Last | Besonderheiten |\n|---|---|---|---:|---|\n${rows.join("\n")}`;
}

const CODE = `So spricht man dieselbe API an, die auch ChatAI nutzt – hier gegen den Mock-Server:

\`\`\`python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8090/v1",   # Produktion: https://chat-ai.academiccloud.de/v1
    api_key="mock",                         # Produktion: eigener API-Key
)

response = client.chat.completions.create(
    model="mock-assistant",
    messages=[{"role": "user", "content": "Hallo!"}],
)
print(response.choices[0].message.content)
\`\`\`

Oder direkt mit \`curl\`:

\`\`\`bash
curl http://localhost:8090/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model": "mock-echo", "messages": [{"role": "user", "content": "Test"}]}'
\`\`\``;

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
  const attachments = [
    ctx.images.length && `${ctx.images.length} Bild(er)`,
    ctx.docs.length && `${ctx.docs.length} Dokument(e)`,
    ctx.audio.length && `${ctx.audio.length} Audio`,
  ].filter(Boolean);
  const rows = [
    ["Modell", `\`${b.model}\``],
    ["Temperatur", b.temperature ?? "–"],
    ["top_p", b.top_p ?? "–"],
    ["Nachrichten im Verlauf", `${ctx.messages.length} (davon ${ctx.users.length} von dir)`],
    ["Systemprompt", ctx.userPrompt ? `„${short(ctx.userPrompt)}“` : "–"],
    ["Anhänge", attachments.join(", ") || "–"],
    ["Tools", ctx.tools.filter((t) => t !== "audio_transcription").join(", ") || "aus"],
    ["Gedächtnis-Einträge", ctx.memories.length || "–"],
  ];
  return `| Parameter | Wert |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${cell(v)} |`).join("\n")}`;
}

function assistant(ctx) {
  const t = ctx.text.toLowerCase();
  const name = nameFromMemory(ctx.memories);

  if (ctx.docs.length) {
    const doc = ctx.docs[0];
    const title = /^#\s+(.+)$/m.exec(doc)?.[1];
    const body = doc.replace(/^#.*$/gm, "").replace(/^_.*_$/gm, "").replace(/^- .*$/gm, "").replace(/\s+/g, " ").trim();
    return {
      content: `Du hast **${ctx.docs.length} Dokument(e)** mitgeschickt${title ? ` – das erste heißt \`${title}\`` : ""} (${doc.length} Zeichen).\n\nSo kommt ein Dokument zu mir: Mit **Process** lädt ChatAI die Datei an \`/documents/convert/file\` hoch. In der Academic Cloud wandelt **Docling** sie in Markdown um, hier übernimmt das der Mock-Server. Der Text wird dann als zusätzlicher Textteil an deine Nachricht gehängt.\n\n**Anfang des Dokuments:**\n\n${quote(short(body || doc, 400))}\n\nEin echtes Modell würde jetzt „${short(ctx.text || "deine Frage", 80)}“ zum Inhalt beantworten.`,
    };
  }

  if (/(ich hei(ß|ss)e|mein name ist|my name is)\s+\S+/i.test(ctx.text)) {
    return {
      content: `Freut mich! ${
        name ? `Laut Gedächtnis heißt du **${name}**.` : "Ich merke mir das allerdings nur, wenn in den Einstellungen das **Gedächtnis (Memory)** auf „Lernen“ steht."
      }\n\nIm Hintergrund schickt ChatAI deine Nachricht dafür an das Memory-Modell (\`memoryGenerationModel\` in \`front.json\`). Gespeicherte Fakten werden bei jeder neuen Anfrage an den Systemprompt angehängt – schreib danach einfach „Hallo“.`,
    };
  }
  if (/^(hallo|hi|hey|moin|servus|guten (morgen|tag|abend)|hello)\b/.test(t)) {
    return {
      content: `Hallo${name ? ` ${name}` : ""}! Ich bin der **Mock Assistent** – ein simuliertes Modell für diese ChatAI-Demo, also kein echtes KI-Modell, sondern ein kleines Regelwerk im Mock-Server.${
        name ? `\n\nDeinen Namen kenne ich aus dem **Gedächtnis**: ChatAI hat ihn an den Systemprompt angehängt.` : ""
      }\n\nDarauf reagiere ich:\n\n${HELP_TABLE}`,
    };
  }
  if (/hilfe|help|was kannst du|wer bist du/.test(t)) return { content: HELP };
  if (/wie funktioniert|architektur|ablauf|datenfluss|how does/.test(t)) return { content: ARCHITECTURE };
  if (/tabelle|table|modelle|übersicht/.test(t)) return { content: modelTable() };
  if (/code|python|curl|api|programm/.test(t)) return { content: CODE };
  if (/formel|latex|mathe|temperatur|formula/.test(t)) return { content: FORMULA };

  if (ctx.usedTools) {
    return {
      content: "Für deine Anfrage habe ich die aktivierten **GWDG-Tools** genutzt – alles simuliert. Die einzelnen Schritte stehen im aufklappbaren Block über dieser Antwort.",
    };
  }
  const attachmentNote = ctx.images.length
    ? `\n\nDu hast ${ctx.images.length} Bild(er) angehängt. Für Bilder ist **Mock Vision** zuständig – oben im Menü auswählen.`
    : "";
  return {
    content: `Du hast geschrieben:\n\n${quote(ctx.text || "(leere Nachricht)")}\n\nIch bin ein Mock und verstehe den Inhalt nicht wirklich. Dafür zeige ich dir, was ChatAI mitgeschickt hat:\n\n${requestDetails(ctx)}${attachmentNote}\n\nTipp: Schreib **„Hilfe“**, um zu sehen, worauf ich reagiere.`,
  };
}

function reasoning(ctx) {
  const q = ctx.text || "(leere Nachricht)";
  const words = q.split(/\s+/).filter(Boolean).length;
  const steps = [
    `Die Frage lautet: „${short(q, 120)}“.`,
    `Sie hat ${words} Wörter und ${q.length} Zeichen.`,
    /\?$/.test(q.trim()) ? "Es ist eine direkte Frage, also antworte ich konkret." : "Es ist keine direkte Frage, eher eine Aussage oder ein Auftrag.",
    `Der Verlauf hat ${ctx.messages.length} Nachrichten, ich beziehe die letzte Nachricht ein.`,
    "Ich prüfe, ob es Fakten gibt, die ich nicht kenne – als Mock kenne ich keine, also bleibe ich ehrlich.",
    "Ich gliedere die Antwort in eine kurze Zusammenfassung und eine Erklärung des Mechanismus.",
    "Zum Schluss prüfe ich, ob die Antwort zur gewählten Denk-Stufe passt.",
  ];
  const count = { none: 0, low: 2, on: 4, medium: 4, high: 7 }[ctx.effort] ?? 4;
  const thought = steps.slice(0, count).map((s, i) => `Schritt ${i + 1}: ${s}`).join("\n\n");
  const content =
    count === 0
      ? `**Thinking ist ausgeschaltet** (Denk-Stufe „none“), deshalb kommt die Antwort ohne Denkprozess.\n\nSchalte in den Einstellungen unter *Reasoning* eine höhere Stufe ein und frag noch einmal.`
      : `**Antwort (simuliert):** Ich habe deine Nachricht in ${count} Schritten „durchdacht“ – aufklappbar im Thinking-Block über dieser Antwort.\n\nSo funktioniert es technisch:\n\n- Der Mock-Server streamt den Denkprozess als \`delta.reasoning\` und erst danach die Antwort als \`delta.content\`.\n- ChatAI legt den Denkprozess in einen eigenen, einklappbaren Block.\n- Die Denk-Stufe kommt aus \`front/src/config/models/mock-reasoning.json\` und wird als \`chat_template_kwargs\` mitgeschickt. Aktuell: **${ctx.effort}**.`;
  return { reasoning: thought, content };
}

function vision(ctx) {
  if (!ctx.images.length) {
    return {
      content:
        "Ich habe kein Bild bekommen. Hänge über die **Büroklammer** ein Bild an (PNG, JPEG, GIF oder WebP) und schick es mit einer Frage.\n\nChatAI erlaubt Bild-Uploads nur bei Modellen, die in `/v1/models` den Eingabetyp `image` haben – das ist bei mir der Fall.",
    };
  }
  const rows = ctx.images.map((img, i) => {
    const info = imageInfo(img.buffer, img.mime);
    const size = info.width && info.height ? `${info.width} × ${info.height} px` : "unbekannt";
    return `| ${i + 1} | ${info.format} | ${kb(img.buffer.length)} | ${size} |`;
  });
  return {
    content: `Ich habe **${ctx.images.length} Bild(er)** erhalten. ChatAI schickt sie als Base64-Daten-URL im Feld \`image_url\` mit:\n\n| # | Format | Größe | Auflösung |\n|---|---|---:|---|\n${rows.join("\n")}\n\n${ctx.text ? `Deine Frage dazu: „${short(ctx.text, 120)}“\n\n` : ""}Ein echtes Vision-Modell (in der Academic Cloud z. B. Qwen-VL oder Gemma) würde jetzt den Bildinhalt beschreiben. Der Mock liest nur die Dateiköpfe aus.`,
  };
}

const SHOWCASE = `# Markdown-Showcase

ChatAI rendert Antworten als **Markdown** – mit *Kursiv*, \`Inline-Code\`, [Links](https://docs.hpc.gwdg.de/services/chat-ai) und mehr.

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

function echo(ctx) {
  const extra = [
    ctx.images.length && `[${ctx.images.length} Bild(er) angehängt]`,
    ctx.docs.length && `[${ctx.docs.length} Dokument(e) angehängt]`,
  ].filter(Boolean).map((n) => "\n\n" + n).join("");
  return { content: (ctx.text || "(leere Nachricht)") + extra };
}

const SLOW = `Diese Antwort kommt absichtlich langsam, Wort für Wort. So sieht man gut, wie Streaming funktioniert: Der Server schickt die Antwort nicht am Stück, sondern in vielen kleinen Teilen als Server-Sent Events. Jedes Teil ist ein kleines JSON-Objekt mit dem nächsten Textstück im Feld delta.content. ChatAI hängt die Stücke sofort an die Nachricht an, deshalb kann man schon mitlesen, während das Modell noch rechnet. Auf großen Rechenclustern wie dem der GWDG kann es bei hoher Last etwas dauern, bis das erste Wort kommt – die Balken neben dem Modellnamen zeigen die aktuelle Auslastung. Tipp: Tippe jetzt auf den Stopp-Button. ChatAI bricht die Anfrage dann ab und behält den Text, der bis dahin angekommen ist.`;

function cloud(ctx) {
  return {
    content: `Dieses Modell ist als **extern** markiert (der Name enthält „External“).\n\nIn der Academic Cloud gibt es neben den Open-Source-Modellen auf GWDG-Servern auch externe Modelle, z. B. von OpenAI. Für solche Modelle zeigt ChatAI:\n\n- einen **Datenschutz-Hinweis** über dem Eingabefeld, weil Daten die GWDG-Infrastruktur verlassen,\n- **keine Tools** (Websuche, Bildgenerierung usw.).\n\nDeine Nachricht: „${short(ctx.text || "(leer)", 120)}“ – sie wurde hier natürlich *nicht* an einen Cloud-Dienst geschickt, sondern nur vom Mock-Server beantwortet.`,
  };
}

const RESPONDERS = {
  "mock-assistant": assistant,
  "mock-reasoning": reasoning,
  "mock-vision": vision,
  "mock-showcase": () => ({ content: SHOWCASE }),
  "mock-echo": echo,
  "mock-slow": () => ({ content: SLOW }),
  "mock-cloud": cloud,
};

export function respond(ctx) {
  const responder = RESPONDERS[ctx.body.model] || assistant;
  return responder(ctx);
}
