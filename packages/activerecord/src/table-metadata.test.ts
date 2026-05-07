import { describe, it } from "vitest";

describe("TableMetadataTest", () => {
  it.skip("#associated_table creates the right type caster for joined table with different association name", () => {
    // BLOCKED: unknown — table-metadata feature gap; needs human triage
    // ROOT-CAUSE: table-metadata.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in table-metadata.ts; affects ~1–10 tests in table-metadata.test.ts
  });
});
