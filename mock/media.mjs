// Small, dependency-free helpers for the mock server:
// image metadata, a tone-based "speech" WAV, an SVG "generated image",
// multipart parsing and a naive PDF text extractor.
import zlib from "node:zlib";

// ---------------------------------------------------------------------------
// Data URLs and image metadata
// ---------------------------------------------------------------------------

export function parseDataUrl(url = "") {
  const match = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s.exec(url);
  if (!match) return null;
  return { mime: match[1] || "application/octet-stream", buffer: Buffer.from(match[2], "base64") };
}

// Returns { format, width, height } by reading the file header only.
export function imageInfo(buf, mime = "") {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { format: "PNG", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.length > 10 && buf.toString("ascii", 0, 4) === "GIF8") {
      return { format: "GIF", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
        if (isSof) return { format: "JPEG", width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return { format: "JPEG" };
    }
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const chunk = buf.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { format: "WebP", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = buf.readUInt32LE(21);
        return { format: "WebP", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { format: "WebP", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
      return { format: "WebP" };
    }
    if (mime.includes("svg") || buf.toString("utf8", 0, 200).includes("<svg")) {
      const head = buf.toString("utf8", 0, 2000);
      const w = /\bwidth="(\d+)/.exec(head);
      const h = /\bheight="(\d+)/.exec(head);
      return { format: "SVG", width: w ? Number(w[1]) : undefined, height: h ? Number(h[1]) : undefined };
    }
  } catch {
    // Fall through to the generic answer below.
  }
  return { format: mime.split("/")[1]?.toUpperCase() || "unbekannt" };
}

// ---------------------------------------------------------------------------
// "Speech": one short tone per word, so the TTS flow can be demonstrated
// without a real voice model.
// ---------------------------------------------------------------------------

export function makeSpeechWav(text = "") {
  const sampleRate = 8000;
  const scale = [262, 294, 330, 392, 440, 523, 587, 659]; // C-major pentatonic-ish
  const words = text.split(/\s+/).filter(Boolean).slice(0, 60);
  const tone = Math.round(sampleRate * 0.12);
  const gap = Math.round(sampleRate * 0.05);
  const samples = new Int16Array(Math.max(1, words.length) * (tone + gap));

  words.forEach((word, w) => {
    const sum = [...word].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const freq = scale[sum % scale.length];
    const offset = w * (tone + gap);
    for (let i = 0; i < tone; i++) {
      const envelope = Math.min(1, i / 200, (tone - i) / 200); // avoid clicks
      samples[offset + i] = Math.round(Math.sin((2 * Math.PI * freq * i) / sampleRate) * 9000 * envelope);
    }
  });

  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------------------
// "Image generation": an SVG poster that shows the prompt.
// ---------------------------------------------------------------------------

const escapeXml = (s) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if ((line + " " + word).trim().length > width) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
}

export function makePromptSvg(prompt = "") {
  const hash = [...prompt].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const hueA = hash % 360;
  const hueB = (hueA + 60 + (hash % 120)) % 360;
  const circles = Array.from({ length: 7 }, (_, i) => {
    const x = (hash >> i) % 512;
    const y = (hash >> (i + 3)) % 512;
    const r = 30 + ((hash >> (i + 5)) % 90);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="white" fill-opacity="0.12"/>`;
  }).join("");
  const lines = wrap(prompt || "Ohne Beschreibung", 26)
    .map((l, i) => `<text x="256" y="${250 + i * 30}" text-anchor="middle" font-size="22" fill="white">${escapeXml(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hueA},70%,45%)"/><stop offset="1" stop-color="hsl(${hueB},70%,35%)"/>
</linearGradient></defs>
<rect width="512" height="512" fill="url(#g)"/>${circles}
<text x="256" y="180" text-anchor="middle" font-family="sans-serif" font-size="16" fill="white" fill-opacity="0.8">MOCK-BILDGENERIERUNG</text>
<g font-family="sans-serif">${lines}</g>
</svg>`;
}

// ---------------------------------------------------------------------------
// multipart/form-data (just enough for file uploads)
// ---------------------------------------------------------------------------

export function parseMultipart(buffer, contentType = "") {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) return [];
  const boundary = Buffer.from("--" + (match[1] || match[2]));
  const parts = [];
  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    const next = buffer.indexOf(boundary, start + boundary.length);
    if (next === -1) break;
    const part = buffer.subarray(start + boundary.length + 2, next - 2); // strip CRLFs
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      parts.push({
        name: /name="([^"]*)"/i.exec(headers)?.[1],
        filename: /filename="([^"]*)"/i.exec(headers)?.[1],
        contentType: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1],
        data: part.subarray(headerEnd + 4),
      });
    }
    start = next;
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Naive PDF text extraction (works for simple PDFs with standard fonts).
// A real deployment uses Docling for this.
// ---------------------------------------------------------------------------

function unescapePdfString(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, c) => {
    const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
    return map[c] ?? String.fromCharCode(parseInt(c, 8));
  });
}

export function extractPdfText(buffer) {
  const raw = buffer.toString("latin1");
  const pages = (raw.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  let text = "";
  const streamRe = /stream\r?\n/g;
  let m;
  while ((m = streamRe.exec(raw)) && text.length < 8000) {
    const end = raw.indexOf("endstream", m.index);
    if (end === -1) break;
    const chunk = buffer.subarray(m.index + m[0].length, end);
    let content;
    try {
      content = zlib.inflateSync(chunk).toString("latin1");
    } catch {
      content = chunk.toString("latin1");
    }
    const opRe = /\[((?:\\.|[^\]\\])*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|(T\*|Td|TD|ET)(?![A-Za-z*])/g;
    let op;
    while ((op = opRe.exec(content))) {
      if (op[1] !== undefined) {
        text += [...op[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((s) => unescapePdfString(s[1])).join("");
      } else if (op[2] !== undefined) {
        text += unescapePdfString(op[2]);
      } else {
        text += op[3] === "ET" ? "\n" : " ";
      }
    }
    streamRe.lastIndex = end;
  }
  text = text.replace(/[^\S\n]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { pages, text: text.slice(0, 8000) };
}
