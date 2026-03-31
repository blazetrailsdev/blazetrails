/**
 * Dev Server Service Worker
 *
 * Runs its own sql.js instance. The main thread sends database snapshots
 * (Uint8Array) via postMessage, and the SW serves files from _vfs_files
 * directly — no round-trip latency.
 */

const DEV_PREFIX = "/~dev/";

/** @type {any} */
let SQL = null;
/** @type {any} */
let db = null;
let ready = false;
let initPromise = null;

async function initSqlJs() {
  if (SQL) return;
  // sql.js UMD build sets window.initSqlJs — in SW context it's self.initSqlJs
  importScripts("/sql-wasm-sw.js");
  SQL = await self.initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });
}

function ensureInit() {
  if (!initPromise) {
    initPromise = initSqlJs().then(() => {
      ready = true;
    });
  }
  return initPromise;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([self.clients.claim(), ensureInit()]));
});

self.addEventListener("message", async (event) => {
  if (event.data?.type === "skip-waiting") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "dev-server:snapshot") {
    await ensureInit();
    const bytes = event.data.data;
    if (db) db.close();
    db = bytes && bytes.length > 0 ? new SQL.Database(bytes) : new SQL.Database();
  }
});

/**
 * Read a file from _vfs_files. For .ts files, prefer pre-compiled JS from _vfs_compiled.
 * @param {string} path
 * @param {boolean} [wantCompiled=false] Whether to return compiled JS for .ts files
 * @returns {{ content: string, found: boolean }}
 */
function readFile(path, wantCompiled = false) {
  if (!db) return { content: "", found: false };

  // For .ts files, try the compiled cache first
  if (wantCompiled && path.endsWith(".ts")) {
    try {
      const stmt = db.prepare(`SELECT "js" FROM "_vfs_compiled" WHERE "path" = ?`);
      stmt.bind([path]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return { content: /** @type {string} */ (row.js), found: true };
      }
      stmt.free();
    } catch {
      // table might not exist, fall through
    }
  }

  try {
    const stmt = db.prepare(`SELECT "content" FROM "_vfs_files" WHERE "path" = ?`);
    stmt.bind([path]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return { content: /** @type {string} */ (row.content), found: true };
    }
    stmt.free();
  } catch {
    // table might not exist yet
  }
  return { content: "", found: false };
}

/**
 * @param {string} path
 * @returns {string}
 */
function mimeType(path) {
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
    case "sql":
      return "text/plain; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}

/**
 * Strip TypeScript type annotations for serving .ts as .js.
 * @param {string} code
 * @returns {string}
 */
function stripTypes(code) {
  // Remove import/export type statements
  code = code.replace(/^\s*(import|export)\s+type\s+[^;]*;?\s*$/gm, "");
  // Remove type-only imports from mixed imports: import { type Foo, Bar } → import { Bar }
  code = code.replace(/,?\s*type\s+\w+/g, "");
  // Remove type annotations `: Type` before , ) = ; { newline
  code = code.replace(
    /:\s*(?:string|number|boolean|any|void|unknown|never|null|undefined|Record<[^>]*>|Array<[^>]*>|Promise<[^>]*>|Map<[^>]*>|Set<[^>]*>|[A-Z]\w*(?:<[^>]*>)?(?:\[\])?(?:\s*\|\s*(?:string|number|boolean|null|undefined|[A-Z]\w*(?:<[^>]*>)?))*)\s*(?=[,)=;\n{])/g,
    " ",
  );
  // Remove `as Type` casts
  code = code.replace(
    /\s+as\s+(?:const|string|number|boolean|any|unknown|[A-Z]\w*(?:<[^>]*>)?)/g,
    "",
  );
  // Remove interface/type alias declarations (single-line and multi-line)
  code = code.replace(/^\s*(?:export\s+)?(?:interface|type)\s+\w+[^{]*\{[^}]*\}\s*;?\s*$/gm, "");
  // Remove generic type params from function/class: foo<T>( → foo(
  code = code.replace(/<\w+(?:\s*,\s*\w+)*(?:\s+extends\s+[^>]+)?>\s*\(/g, "(");
  // Remove `!` non-null assertions
  code = code.replace(/(\w)!/g, "$1");
  return code;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith(DEV_PREFIX)) return;
  event.respondWith(handleDevRequest(url));
});

/**
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleDevRequest(url) {
  await ensureInit();

  let path = url.pathname.slice(DEV_PREFIX.length);
  if (!path || path.endsWith("/")) path += "index.html";

  // Try exact, then .ts, .html, /index.html
  // For .ts files, prefer compiled JS from cache
  let result = readFile(path, true);
  if (!result.found && !path.includes(".")) {
    result = readFile(path + ".ts", true);
    if (result.found) path += ".ts";
    if (!result.found) {
      result = readFile(path + ".html");
      if (result.found) path += ".html";
    }
    if (!result.found) {
      result = readFile(path + "/index.html");
      if (result.found) path += "/index.html";
    }
  }

  if (!result.found) {
    return new Response(`404 — ${path} not found in VFS`, {
      status: 404,
      headers: { "content-type": "text/plain" },
    });
  }

  let content = result.content;
  // If we got raw .ts (no compiled cache), fall back to regex strip
  if (path.endsWith(".ts") && content.includes(": ")) {
    content = stripTypes(content);
  }

  // Inject error capture script into HTML pages
  if (path.endsWith(".html") && content.includes("<head")) {
    const errorScript = `<script>
window.addEventListener("error", function(e) {
  parent.postMessage({ type: "frontiers:error", message: e.message + " at " + (e.filename || "") + ":" + (e.lineno || "") }, "*");
});
window.addEventListener("unhandledrejection", function(e) {
  parent.postMessage({ type: "frontiers:error", message: "Unhandled rejection: " + (e.reason?.message || e.reason || "unknown") }, "*");
});
</script>`;
    // Insert after <head> or <head ...>
    content = content.replace(/(<head[^>]*>)/, "$1" + errorScript);
  }

  return new Response(content, {
    status: 200,
    headers: {
      "content-type": mimeType(path),
      "cache-control": "no-store",
      "x-vfs-path": path,
    },
  });
}
