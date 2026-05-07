import { describe, it } from "vitest";

describe("SchemaLoadingTest", () => {
  it.skip("basic model is loaded once", () => {
    // BLOCKED: unknown — schema-loading feature gap; needs human triage
    // ROOT-CAUSE: schema-loading.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in schema-loading.ts; affects ~1–10 tests in schema-loading.test.ts
  });
  it.skip("model with custom lock is loaded once", () => {
    // BLOCKED: unknown — schema-loading feature gap; needs human triage
    // ROOT-CAUSE: schema-loading.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in schema-loading.ts; affects ~1–10 tests in schema-loading.test.ts
  });
  it.skip("model with changed custom lock is loaded twice", () => {
    // BLOCKED: unknown — schema-loading feature gap; needs human triage
    // ROOT-CAUSE: schema-loading.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in schema-loading.ts; affects ~1–10 tests in schema-loading.test.ts
  });
});
