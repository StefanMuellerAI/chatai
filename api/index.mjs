// Vercel entry point for the Chat AI mock demo.
//
// Starts the mock API (mock/server.mjs) and the unchanged Chat AI back service
// (back/service.mjs) inside this function instance and forwards requests:
//   /backend/*  -> back service on 127.0.0.1:18081  (as front -> back in docker-compose)
//   /v1/*       -> mock API on 127.0.0.1:18090      (OpenAI-compatible, for direct API use)
// The back service reaches the mock through vercel/back.json.
import http from "node:http";
import net from "node:net";
import { fileURLToPath } from "node:url";

const MOCK_PORT = 18090;
const BACK_PORT = 18081; // must match "port" in vercel/back.json

process.env.MOCK_PORT = String(MOCK_PORT);
process.env.CONFIG_LOCATION = fileURLToPath(new URL("../vercel/back.json", import.meta.url));
await import("../mock/server.mjs");
await import("../back/service.mjs");

function waitForPort(port, timeoutMs = 10000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`Port ${port} did not open`));
        else setTimeout(attempt, 50);
      });
    };
    attempt();
  });
}

const ready = Promise.all([waitForPort(MOCK_PORT), waitForPort(BACK_PORT)]);
const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-connection"];

export default async function handler(req, res) {
  await ready;
  const url = new URL(req.url, "http://localhost");
  // vercel.json rewrites pass service and path as query parameters; fall back to
  // the URL path when the function is called directly (e.g. in a local test).
  let service = url.searchParams.get("__service");
  let path = url.searchParams.get("__path") ?? "";
  if (service === null) {
    const match = /^\/(?:api\/index\/)?(backend|v1)(?:\/(.*))?$/.exec(url.pathname);
    service = match?.[1];
    path = match?.[2] ?? "";
  }
  url.searchParams.delete("__service");
  url.searchParams.delete("__path");
  if (service !== "backend" && service !== "v1") {
    res.statusCode = 404;
    return res.end("Not found");
  }

  const port = service === "v1" ? MOCK_PORT : BACK_PORT;
  const query = url.searchParams.toString();
  const targetPath = (service === "v1" ? `/v1/${path}` : `/${path}`) + (query ? `?${query}` : "");
  const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !HOP_BY_HOP.includes(k)));

  const upstream = http.request({ host: "127.0.0.1", port, method: req.method, path: targetPath, headers }, (up) => {
    const responseHeaders = Object.fromEntries(Object.entries(up.headers).filter(([k]) => !HOP_BY_HOP.includes(k)));
    res.writeHead(up.statusCode, responseHeaders);
    up.pipe(res); // streams Server-Sent Events chunk by chunk
  });
  upstream.on("error", (err) => {
    console.error("Upstream error:", err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: { message: "Demo backend unavailable" } }));
    } else {
      res.end();
    }
  });
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}
