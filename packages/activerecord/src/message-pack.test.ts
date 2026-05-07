import { describe, it } from "vitest";

describe("ActiveRecordMessagePackTest", () => {
  it.skip("enshrines type IDs", () => {
    // BLOCKED: unknown — message-pack feature gap; needs human triage
    // ROOT-CAUSE: message-pack.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in message-pack.ts; affects ~1–10 tests in message-pack.test.ts
  });
  it.skip("roundtrips record and cached associations", () => {
    // BLOCKED: unknown — message-pack feature gap; needs human triage
    // ROOT-CAUSE: message-pack.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in message-pack.ts; affects ~1–10 tests in message-pack.test.ts
  });
  it.skip("roundtrips new_record? status", () => {
    // BLOCKED: unknown — message-pack feature gap; needs human triage
    // ROOT-CAUSE: message-pack.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in message-pack.ts; affects ~1–10 tests in message-pack.test.ts
  });
  it.skip("roundtrips binary attribute", () => {
    // BLOCKED: unknown — message-pack feature gap; needs human triage
    // ROOT-CAUSE: message-pack.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in message-pack.ts; affects ~1–10 tests in message-pack.test.ts
  });
  it.skip("raises ActiveSupport::MessagePack::MissingClassError if record class no longer exists", () => {
    // BLOCKED: unknown — message-pack feature gap; needs human triage
    // ROOT-CAUSE: message-pack.ts missing Rails parity; exact symbol unclear without running the test
    // SCOPE: ~30–100 LOC fix in message-pack.ts; affects ~1–10 tests in message-pack.test.ts
  });
});
