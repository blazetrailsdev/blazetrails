import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { CompiledCache } from "./compiled-cache.js";

let adapter: SqlJsAdapter;
let cache: CompiledCache;

beforeEach(async () => {
  const SQL = await initSqlJs();
  adapter = new SqlJsAdapter(new SQL.Database());
  cache = new CompiledCache(adapter);
});

describe("CompiledCache", () => {
  it("stores and retrieves compiled JS", () => {
    cache.set("app/main.ts", "console.log('hi');", "hash1");
    expect(cache.get("app/main.ts")).toBe("console.log('hi');");
  });

  it("returns null for missing files", () => {
    expect(cache.get("nope.ts")).toBeNull();
  });

  it("updates existing entries", () => {
    cache.set("a.ts", "v1", "h1");
    cache.set("a.ts", "v2", "h2");
    expect(cache.get("a.ts")).toBe("v2");
    expect(cache.getSourceHash("a.ts")).toBe("h2");
  });

  it("tracks source hash", () => {
    cache.set("a.ts", "js", "myhash");
    expect(cache.getSourceHash("a.ts")).toBe("myhash");
  });

  it("returns null hash for missing files", () => {
    expect(cache.getSourceHash("nope.ts")).toBeNull();
  });

  it("deletes entries", () => {
    cache.set("a.ts", "js", "h");
    cache.delete("a.ts");
    expect(cache.get("a.ts")).toBeNull();
  });

  it("handles special characters in content", () => {
    const js = "const s = 'it\\'s a test'; console.log(`hello ${s}`);";
    cache.set("a.ts", js, "h");
    expect(cache.get("a.ts")).toBe(js);
  });
});
