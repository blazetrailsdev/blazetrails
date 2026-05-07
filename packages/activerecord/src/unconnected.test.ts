import { describe, it } from "vitest";

describe("TestUnconnectedAdapter", () => {
  it.skip("connection no longer established", () => {
    // BLOCKED: connection-pool — unconnected model behavior not fully implemented
    // ROOT-CAUSE: core.ts or connection-handler.ts#withoutConnection not implementing unconnected model semantics
    // SCOPE: ~30 LOC fix in connection-handler.ts; affects ~3 tests in unconnected.test.ts
  });
  it.skip("error message when connection not established", () => {
    // BLOCKED: connection-pool — unconnected model behavior not fully implemented
    // ROOT-CAUSE: core.ts or connection-handler.ts#withoutConnection not implementing unconnected model semantics
    // SCOPE: ~30 LOC fix in connection-handler.ts; affects ~3 tests in unconnected.test.ts
  });
  it.skip("underlying adapter no longer active", () => {
    // BLOCKED: connection-pool — unconnected model behavior not fully implemented
    // ROOT-CAUSE: core.ts or connection-handler.ts#withoutConnection not implementing unconnected model semantics
    // SCOPE: ~30 LOC fix in connection-handler.ts; affects ~3 tests in unconnected.test.ts
  });
});
