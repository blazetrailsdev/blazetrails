/**
 * Frontiers Server
 *
 * Serves both the API and the static SvelteKit build.
 * In production (dokku), the static files are served from ./build/
 */

import { createServer } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { createDatabase } from "./db.js";
import { createHandler } from "./handler.js";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const DB_PATH = process.env.DB_PATH ?? "frontiers-api.sqlite3";
const BASE_URL =
  process.env.BASE_URL ?? `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
const STATIC_DIR = process.env.STATIC_DIR ?? join(import.meta.dirname ?? ".", "../build");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

const db = createDatabase(DB_PATH);

const apiHandler = createHandler({
  db,
  baseUrl: BASE_URL,
  async sendEmail(to, subject, body) {
    // TODO: plug in Resend/Postmark/SMTP
    console.log(`[email] To: ${to}\n  Subject: ${subject}\n  ${body}\n`);
  },
});

function serveStatic(url: string, res: import("http").ServerResponse): boolean {
  // Try exact file, then with .html, then /index.html
  const candidates = [
    join(STATIC_DIR, url),
    join(STATIC_DIR, url + ".html"),
    join(STATIC_DIR, url, "index.html"),
  ];

  for (const filePath of candidates) {
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] ?? "application/octet-stream";
      const cacheControl = url.includes("/_app/immutable/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=60";

      res.writeHead(200, {
        "content-type": mime,
        "cache-control": cacheControl,
      });
      createReadStream(filePath).pipe(res);
      return true;
    }
  }
  return false;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // API routes
  if (url.pathname.startsWith("/api/")) {
    return apiHandler(req, res);
  }

  // Static files
  if (serveStatic(url.pathname, res)) return;

  // SPA fallback — serve index.html for client-side routes
  const fallback = join(STATIC_DIR, "index.html");
  if (existsSync(fallback)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    createReadStream(fallback).pipe(res);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Frontiers listening on http://${HOST}:${PORT}`);
  console.log(`  Static: ${STATIC_DIR}`);
  console.log(`  API: ${BASE_URL}/api/`);
});
