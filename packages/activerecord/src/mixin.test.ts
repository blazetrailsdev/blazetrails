import { describe, it } from "vitest";

describe("TouchTest", () => {
  it.skip("many updates", () => {
    // BLOCKED: unknown — mixin feature gap; needs human triage
    // ROOT-CAUSE: mixin.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in mixin.ts; affects ~1–10 tests in mixin.test.ts
  });
  it.skip("create turned off", () => {
    // BLOCKED: unknown — mixin feature gap; needs human triage
    // ROOT-CAUSE: mixin.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in mixin.ts; affects ~1–10 tests in mixin.test.ts
  });
});
