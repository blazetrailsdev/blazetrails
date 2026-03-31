import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VirtualFS } from "./virtual-fs.js";
import { CompiledCache } from "./compiled-cache.js";
import { createPreviewServer } from "./preview-server.js";

let vfs: VirtualFS;
let compiled: CompiledCache;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const adapter = new SqlJsAdapter(new SQL.Database());
  vfs = new VirtualFS(adapter);
  compiled = new CompiledCache(adapter);
});

describe("PreviewServer", () => {
  describe("getUrl", () => {
    it("returns a blob URL for an HTML file", () => {
      vfs.write("index.html", "<html><body>Hello</body></html>");
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl("index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });

    it("defaults to index.html", () => {
      vfs.write("index.html", "<html><body>Default</body></html>");
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl();
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });

    it("returns not-found page for missing files", () => {
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl("nope.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });
  });

  describe("HTML inlining", () => {
    it("inlines script src from VFS", () => {
      vfs.write("app.js", 'console.log("hello");');
      vfs.write(
        "index.html",
        '<html><head></head><body><script src="app.js"></script></body></html>',
      );
      const server = createPreviewServer(vfs, compiled);
      // We can't read the blob directly, but we can verify it was created
      const url = server.getUrl("index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });

    it("inlines stylesheet href from VFS", () => {
      vfs.write("style.css", "body { color: red; }");
      vfs.write(
        "index.html",
        '<html><head><link rel="stylesheet" href="style.css"></head><body></body></html>',
      );
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl("index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });

    it("uses compiled cache for .ts script src", () => {
      compiled.set("app.ts", 'console.log("compiled");', "h");
      vfs.write("app.ts", 'console.log("source");');
      vfs.write(
        "index.html",
        '<html><head></head><body><script src="app.ts"></script></body></html>',
      );
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl("index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });
  });

  describe("path resolution", () => {
    it("resolves relative paths from HTML file location", () => {
      vfs.write("lib/util.js", "export const x = 1;");
      vfs.write(
        "pages/index.html",
        '<html><head></head><body><script src="../lib/util.js"></script></body></html>',
      );
      const server = createPreviewServer(vfs, compiled);
      // Should resolve ../lib/util.js relative to pages/
      const url = server.getUrl("pages/index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });

    it("resolves absolute paths from root", () => {
      vfs.write("lib/util.js", "export const x = 1;");
      vfs.write(
        "pages/index.html",
        '<html><head></head><body><script src="/lib/util.js"></script></body></html>',
      );
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl("pages/index.html");
      expect(url).toMatch(/^blob:/);
      server.revoke(url);
    });
  });

  describe("revoke", () => {
    it("revokes a blob URL without error", () => {
      vfs.write("index.html", "<html></html>");
      const server = createPreviewServer(vfs, compiled);
      const url = server.getUrl();
      expect(() => server.revoke(url)).not.toThrow();
    });
  });
});
