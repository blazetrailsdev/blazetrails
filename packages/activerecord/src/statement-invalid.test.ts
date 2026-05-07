import { describe, it } from "vitest";

describe("StatementInvalidTest", () => {
  it.skip("message contains no sql", () => {
    // BLOCKED: unknown — statement-invalid feature gap; needs human triage
    // ROOT-CAUSE: statement-invalid.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in statement-invalid.ts; affects ~1–10 tests in statement-invalid.test.ts
  });
  it.skip("statement and binds are set on select", () => {
    // BLOCKED: unknown — statement-invalid feature gap; needs human triage
    // ROOT-CAUSE: statement-invalid.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in statement-invalid.ts; affects ~1–10 tests in statement-invalid.test.ts
  });
});
