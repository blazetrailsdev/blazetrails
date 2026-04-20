/**
 * Focused tests for the extractor's re-export path resolution.
 * End-to-end re-export recognition is covered transitively by
 * `api:compare` + the manifest; these pin the path-math so keys
 * stay platform-stable and the two supported patterns both
 * resolve to the same target.
 */

import { describe, it, expect } from "vitest";
import { resolveRelModule } from "./extract-ts-api.js";

describe("resolveRelModule", () => {
  it("resolves a sibling .js import", () => {
    expect(resolveRelModule("migration.ts", "./migration-errors.js")).toBe("migration-errors.ts");
  });

  it("resolves an upward (..) specifier", () => {
    expect(resolveRelModule("connection-adapters/mysql2-adapter.ts", "../adapter.js")).toBe(
      "adapter.ts",
    );
  });

  it("resolves a nested specifier across subfolders", () => {
    expect(
      resolveRelModule(
        "adapters/abstract-mysql-adapter/test-helper.ts",
        "../../connection-adapters/mysql2-adapter.js",
      ),
    ).toBe("connection-adapters/mysql2-adapter.ts");
  });

  it("strips both .js and .ts extensions", () => {
    expect(resolveRelModule("a.ts", "./b.js")).toBe("b.ts");
    expect(resolveRelModule("a.ts", "./b.ts")).toBe("b.ts");
  });

  it("returns null for package / absolute specifiers", () => {
    expect(resolveRelModule("a.ts", "typescript")).toBeNull();
    expect(resolveRelModule("a.ts", "@blazetrails/activesupport")).toBeNull();
    expect(resolveRelModule("a.ts", "node:fs")).toBeNull();
  });

  it("emits POSIX-style separators regardless of input", () => {
    // Directory walk uses POSIX separators in relPath keys; the
    // resolver must never introduce backslashes even if fed one.
    const result = resolveRelModule("dir/sub/file.ts", "./sibling.js");
    expect(result).toBe("dir/sub/sibling.ts");
    expect(result).not.toContain("\\");
  });
});
