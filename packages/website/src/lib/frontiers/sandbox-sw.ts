/**
 * Sandbox Service Worker
 *
 * Hosts the full runtime: sql.js, VFS, CLI, executeCode, Rack app server.
 * The main thread communicates via the SW message protocol defined in sw-protocol.ts.
 * Fetch requests to /~dev/* are served from the VFS.
 */

declare const self: ServiceWorkerGlobalScope;

import type { SwRequest, SwResponse, SwBroadcast } from "./sw-protocol.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";
import { CompiledCache } from "./compiled-cache.js";
import { stripTypes } from "./transpiler.js";
import { createTrailCLI, type CliResult } from "./trail-cli.js";
import { createAppServer, type AppServer } from "./app-server.js";
import { requestToRackEnvWithBody, rackResponseToFetchResponse } from "./rack-bridge.js";
import { Base } from "@blazetrails/activerecord/base";
import { Migration, Migrator } from "@blazetrails/activerecord/migration";
import type { MigrationProxy } from "@blazetrails/activerecord/migration";
import { MigrationRunner } from "@blazetrails/activerecord/migration-runner";
import { Schema } from "@blazetrails/activerecord/schema";
import { ActionController } from "@blazetrails/actionpack";

import initSqlJs from "sql.js";

const DEV_PREFIX = "/~dev/";

// ── Runtime state ──────────────────────────────────────────────────────

let SQL: Awaited<ReturnType<typeof initSqlJs>>;
let db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>;
let adapter: SqlJsAdapter;
let vfs: VirtualFS;
let compiled: CompiledCache;
let migrations: MigrationProxy[] = [];
let cli: ReturnType<typeof createTrailCLI>;
let appServer: AppServer;
let initialized = false;

// ── executeCode ────────────────────────────────────────────────────────

async function executeCode(code: string): Promise<unknown> {
  const fn = new Function(
    "Base",
    "Migration",
    "MigrationRunner",
    "Migrator",
    "Schema",
    "ActionController",
    "adapter",
    "app",
    `return (async () => { ${code} })();`,
  );
  return fn(
    Base,
    Migration,
    MigrationRunner,
    Migrator,
    Schema,
    ActionController,
    adapter,
    appServer,
  );
}

// ── Migration registry ─────────────────────────────────────────────────

function registerMigration(proxy: MigrationProxy): void {
  const idx = migrations.findIndex((m) => m.version === proxy.version);
  if (idx >= 0) {
    migrations[idx] = proxy;
  } else {
    migrations.push(proxy);
  }
}

// ── Initialization ─────────────────────────────────────────────────────

async function init(): Promise<void> {
  if (initialized) return;

  SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });

  db = new SQL.Database();
  adapter = new SqlJsAdapter(db);
  Base.adapter = adapter;
  vfs = new VirtualFS(adapter);
  compiled = new CompiledCache(adapter);

  cli = createTrailCLI({
    vfs,
    adapter,
    executeCode,
    getMigrations: () => [...migrations],
    registerMigration,
    clearMigrations: () => {
      migrations = [];
    },
    getTables: () => adapter.getTables(),
  });

  appServer = createAppServer({ executeCode });

  initialized = true;
}

// ── SW lifecycle ───────────────────────────────────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Broadcast helper ───────────────────────────────────────────────────

async function broadcast(msg: SwBroadcast): Promise<void> {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage(msg);
  }
}

// ── Message handler ────────────────────────────────────────────────────

export async function handleSwMessage(request: SwRequest): Promise<SwResponse> {
  switch (request.type) {
    case "init":
      await init();
      return { type: "init", ready: true };

    case "vfs:list":
      return { type: "vfs:list", files: vfs.list() };

    case "vfs:read":
      return { type: "vfs:read", file: vfs.read(request.path) };

    case "vfs:write":
      vfs.write(request.path, request.content, request.language);
      await broadcast({ type: "vfs:changed" });
      return { type: "vfs:write", ok: true };

    case "vfs:delete": {
      const deleted = vfs.delete(request.path);
      if (deleted) await broadcast({ type: "vfs:changed" });
      return { type: "vfs:delete", deleted };
    }

    case "vfs:rename": {
      const renamed = vfs.rename(request.oldPath, request.newPath);
      if (renamed) await broadcast({ type: "vfs:changed" });
      return { type: "vfs:rename", renamed };
    }

    case "vfs:exists":
      return { type: "vfs:exists", exists: vfs.exists(request.path) };

    case "db:tables":
      return {
        type: "db:tables",
        tables: adapter.getTables().filter((t) => !t.startsWith("_vfs_")),
      };

    case "db:columns":
      return { type: "db:columns", columns: adapter.getColumns(request.table) };

    case "db:query":
      return { type: "db:query", results: adapter.execRaw(request.sql) };

    case "exec": {
      const result: CliResult = await cli.exec(request.command);
      await broadcast({ type: "vfs:changed" });
      await broadcast({ type: "db:changed" });
      return { type: "exec", result };
    }

    case "db:export":
      return { type: "db:export", data: db.export() };

    case "db:import": {
      db.close();
      db = new SQL.Database(request.data);
      adapter = new SqlJsAdapter(db);
      Base.adapter = adapter;
      vfs = new VirtualFS(adapter);
      compiled = new CompiledCache(adapter);
      migrations = [];
      cli = createTrailCLI({
        vfs,
        adapter,
        executeCode,
        getMigrations: () => [...migrations],
        registerMigration,
        clearMigrations: () => {
          migrations = [];
        },
        getTables: () => adapter.getTables(),
      });
      await broadcast({ type: "vfs:changed" });
      await broadcast({ type: "db:changed" });
      return { type: "db:import", ok: true };
    }
  }
}

self.addEventListener("message", (event) => {
  const port = event.ports[0];
  if (!port) return;

  const request = event.data as SwRequest;

  handleSwMessage(request)
    .then((response) => port.postMessage(response))
    .catch((err: Error) => port.postMessage({ type: "error", message: err.message }));
});

// ── Fetch handler ──────────────────────────────────────────────────────

function mimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return "text/html; charset=utf-8";
    case "css":
      return "text/css; charset=utf-8";
    case "js":
      return "application/javascript; charset=utf-8";
    case "ts":
      return "application/javascript; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "svg":
      return "image/svg+xml";
    case "md":
      return "text/markdown; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

function readFile(path: string, wantCompiled = false): { content: string; found: boolean } {
  if (!vfs) return { content: "", found: false };

  // For .ts files, prefer compiled JS from cache
  if (wantCompiled && path.endsWith(".ts")) {
    const js = compiled.get(path);
    if (js) return { content: js, found: true };
  }

  const file = vfs.read(path);
  if (file) return { content: file.content, found: true };

  return { content: "", found: false };
}

function resolvePath(path: string): { path: string; result: { content: string; found: boolean } } {
  // Try exact path (prefer compiled for .ts)
  let result = readFile(path, true);
  if (result.found) return { path, result };

  // Try public/ prefix (Rails convention: public/ is the web root)
  result = readFile(`public/${path}`, false);
  if (result.found) return { path: `public/${path}`, result };

  // Try extensions: .ts, .html, /index.html
  if (!path.includes(".")) {
    for (const ext of [".ts", ".html"]) {
      result = readFile(path + ext, ext === ".ts");
      if (result.found) return { path: path + ext, result };
    }
    result = readFile(`${path}/index.html`, false);
    if (result.found) return { path: `${path}/index.html`, result };

    // Also try public/ with extensions
    result = readFile(`public/${path}/index.html`, false);
    if (result.found) return { path: `public/${path}/index.html`, result };
  }

  return { path, result: { content: "", found: false } };
}

const ERROR_CAPTURE_SCRIPT = `<script>
window.addEventListener("error", function(e) {
  parent.postMessage({ type: "frontiers:error", message: e.message + " at " + (e.filename || "") + ":" + (e.lineno || "") }, "*");
});
window.addEventListener("unhandledrejection", function(e) {
  parent.postMessage({ type: "frontiers:error", message: "Unhandled rejection: " + (e.reason?.message || e.reason || "unknown") }, "*");
});
</script>`;

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(DEV_PREFIX)) return;

  event.respondWith(handleFetch(event.request, url));
});

async function handleFetch(request: Request, url: URL): Promise<Response> {
  if (!initialized) {
    await init();
  }

  let path = url.pathname.slice(DEV_PREFIX.length);
  if (!path || path.endsWith("/")) path += "index.html";

  // Check if this should be dispatched to the Rack app server
  if (appServer.routes && path.startsWith("api/")) {
    try {
      const env = await requestToRackEnvWithBody(request, "/~dev");
      const rackResponse = await appServer.call(env);
      return await rackResponseToFetchResponse(rackResponse);
    } catch {
      // Fall through to static file serving
    }
  }

  const resolved = resolvePath(path);
  if (!resolved.result.found) {
    return new Response(`404 — ${path} not found in VFS`, {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  let content = resolved.result.content;

  // If we got raw .ts (no compiled cache hit), strip types
  if (resolved.path.endsWith(".ts") && content.includes(":")) {
    content = stripTypes(content);
  }

  // Inject error capture script into HTML pages
  if (resolved.path.endsWith(".html") && content.includes("<head")) {
    content = content.replace(/(<head[^>]*>)/, "$1" + ERROR_CAPTURE_SCRIPT);
  }

  return new Response(content, {
    status: 200,
    headers: {
      "content-type": mimeType(resolved.path),
      "cache-control": "no-store",
      "x-vfs-path": resolved.path,
    },
  });
}
