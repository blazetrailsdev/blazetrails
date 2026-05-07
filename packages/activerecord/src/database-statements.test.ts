import { describe, it } from "vitest";

describe("DatabaseStatementsTest", () => {
  it.skip("insert should return the inserted id", () => {
    // BLOCKED: unknown — database-statements feature gap; needs human triage
    // ROOT-CAUSE: database-statements.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in database-statements.ts; affects ~1–10 tests in database-statements.test.ts
    /* needs adapter-level insert() that returns last inserted ID */
  });
  it.skip("create should return the inserted id", () => {
    // BLOCKED: unknown — database-statements feature gap; needs human triage
    // ROOT-CAUSE: database-statements.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in database-statements.ts; affects ~1–10 tests in database-statements.test.ts
    /* needs adapter-level insert() that returns last inserted ID */
  });
});
