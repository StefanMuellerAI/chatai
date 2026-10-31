// Checks that every model configured in the web interface
// (front/src/config/models/<id>.json) has a mock model with the same ID,
// so reasoning settings and the model list stay in sync after upstream updates.
// Usage: node mock/check-catalog.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHAT_MODELS } from "./catalog.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../front/src/config/models");
const configured = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
const ids = new Set(CHAT_MODELS.map((m) => m.id));
const missing = configured.filter((id) => !ids.has(id));
const noThinking = configured.filter((id) => ids.has(id) && !CHAT_MODELS.find((m) => m.id === id).mock.thinking);

console.log(`${configured.length} model configs in the web interface, ${CHAT_MODELS.length} mock chat models.`);
if (noThinking.length) console.log("Config with reasoning options, but mock model without thinking:", noThinking.join(", "));
if (missing.length) {
  console.log("Missing in mock/catalog.mjs:", missing.join(", "));
  process.exit(1);
}
console.log("OK: every configured model has a mock model.");
