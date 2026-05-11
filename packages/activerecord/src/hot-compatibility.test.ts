import { describe, it } from "vitest";

describe("HotCompatibilityTest", () => {
  it.skip("insert after remove_column", () => {
    // PERMANENT-SKIP: Ruby-only (see scripts/api-compare/excluded-files.ts) — migration/compatibility
  });
  it.skip("update after remove_column", () => {
    // PERMANENT-SKIP: Ruby-only (see scripts/api-compare/excluded-files.ts) — migration/compatibility
  });
  it.skip("cleans up after prepared statement failure in a transaction", () => {
    // PERMANENT-SKIP: Ruby-only (see scripts/api-compare/excluded-files.ts) — migration/compatibility
  });
  it.skip("cleans up after prepared statement failure in nested transactions", () => {
    // PERMANENT-SKIP: Ruby-only (see scripts/api-compare/excluded-files.ts) — migration/compatibility
  });
});
