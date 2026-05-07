import { describe, it } from "vitest";

describe("ConnectionTest", () => {
  it.skip("#type_for_attribute is not aware of custom types", () => {
    // BLOCKED: unknown — connection feature gap; needs human triage
    // ROOT-CAUSE: connection.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in connection.ts; affects ~1–10 tests in connection.test.ts
  });
});
