/**
 * Preview server that works without a service worker.
 * Constructs blob URLs from VFS files for the iframe.
 * Falls back to this when SW registration fails (e.g. non-HTTPS).
 */

import type { VirtualFS } from "./virtual-fs.js";
import { stripTypes } from "./transpiler.js";
import type { CompiledCache } from "./compiled-cache.js";

export interface PreviewServer {
  /** Generate a blob URL for a given VFS path. */
  getUrl: (path?: string) => string;
  /** Revoke a previously generated blob URL. */
  revoke: (url: string) => void;
}

function mimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
      return "text/html";
    case "css":
      return "text/css";
    case "js":
      return "application/javascript";
    case "ts":
      return "application/javascript";
    case "json":
      return "application/json";
    case "svg":
      return "image/svg+xml";
    default:
      return "text/plain";
  }
}

const ERROR_CAPTURE_SCRIPT = `<script>
window.addEventListener("error", function(e) {
  parent.postMessage({ type: "frontiers:error", message: e.message + " at " + (e.filename || "") + ":" + (e.lineno || "") }, "*");
});
window.addEventListener("unhandledrejection", function(e) {
  parent.postMessage({ type: "frontiers:error", message: "Unhandled rejection: " + (e.reason?.message || e.reason || "unknown") }, "*");
});
</script>`;

export function createPreviewServer(
  vfs: VirtualFS,
  compiled?: CompiledCache | null,
): PreviewServer {
  function resolveContent(path: string): { content: string; mime: string } | null {
    // For .ts files, prefer compiled JS
    if (path.endsWith(".ts") && compiled) {
      const js = compiled.get(path);
      if (js) return { content: js, mime: "application/javascript" };
    }

    const file = vfs.read(path);
    if (!file) return null;

    let content = file.content;
    if (path.endsWith(".ts")) {
      content = stripTypes(content);
    }

    return { content, mime: mimeType(path) };
  }

  /**
   * For HTML files, inline all <script src="..."> and <link href="...">
   * references from the VFS so the blob URL is self-contained.
   */
  function buildHtmlBlob(htmlPath: string): string {
    const file = vfs.read(htmlPath);
    if (!file) return "<html><body>Not found</body></html>";

    let html = file.content;

    // Inject error capture
    html = html.replace(/(<head[^>]*>)/, `$1${ERROR_CAPTURE_SCRIPT}`);

    // Inline <script src="..."> from VFS
    html = html.replace(/<script\s+src=["']([^"']+)["'][^>]*><\/script>/gi, (_match, src) => {
      const resolved = resolveContent(normalizePath(htmlPath, src));
      if (!resolved) return `<!-- VFS: ${src} not found -->`;
      return `<script>${resolved.content}</script>`;
    });

    // Inline <link rel="stylesheet" href="..."> from VFS
    html = html.replace(/<link\s+[^>]*href=["']([^"']+)["'][^>]*>/gi, (match, href) => {
      if (!match.includes("stylesheet")) return match;
      const resolved = resolveContent(normalizePath(htmlPath, href));
      if (!resolved) return `<!-- VFS: ${href} not found -->`;
      return `<style>${resolved.content}</style>`;
    });

    return html;
  }

  function normalizePath(from: string, relative: string): string {
    if (relative.startsWith("/")) return relative.slice(1);
    const dir = from.includes("/") ? from.split("/").slice(0, -1).join("/") : "";
    return dir ? `${dir}/${relative}` : relative;
  }

  return {
    getUrl(path = "index.html") {
      const html = buildHtmlBlob(path);
      const blob = new Blob([html], { type: "text/html" });
      return URL.createObjectURL(blob);
    },

    revoke(url: string) {
      URL.revokeObjectURL(url);
    },
  };
}
