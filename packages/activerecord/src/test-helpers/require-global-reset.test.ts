import { describe, it, expect, afterEach } from "vitest";
import {
  popRequireGlobalReset,
  pushRequireGlobalReset,
  shouldRunGlobalReset,
  useGlobalReset,
} from "./require-global-reset.js";

// The refcount is process-global; drain any residue so a failing assertion
// in one test can't leave the global beforeEach drop armed for the next.
afterEach(() => {
  while (shouldRunGlobalReset()) popRequireGlobalReset();
});

describe("requireGlobalReset", () => {
  it("is opt-in: global reset is off by default", () => {
    expect(shouldRunGlobalReset()).toBe(false);
  });

  it("enables the reset while a scope is pushed", () => {
    pushRequireGlobalReset();
    expect(shouldRunGlobalReset()).toBe(true);
    popRequireGlobalReset();
    expect(shouldRunGlobalReset()).toBe(false);
  });

  it("refcounts nested scopes so an inner pop doesn't disable an outer scope", () => {
    pushRequireGlobalReset();
    pushRequireGlobalReset();
    expect(shouldRunGlobalReset()).toBe(true);

    expect(popRequireGlobalReset()).toBe(1);
    expect(shouldRunGlobalReset()).toBe(true);

    expect(popRequireGlobalReset()).toBe(0);
    expect(shouldRunGlobalReset()).toBe(false);
  });

  it("never drives the depth negative on an unbalanced pop", () => {
    expect(popRequireGlobalReset()).toBe(0);
    expect(shouldRunGlobalReset()).toBe(false);
  });
});

// useGlobalReset() is the hook all opt-in files use. Exercise its wiring:
// the beforeAll it registers must enable the reset for the duration of the
// suite, and its afterAll must drain the refcount back to zero (and run the
// final reset) when this outermost scope exits.
describe("useGlobalReset wiring", () => {
  useGlobalReset();

  it("enables the global reset for tests in the opted-in suite", () => {
    expect(shouldRunGlobalReset()).toBe(true);
  });

  it("keeps the reset enabled across multiple tests in the suite", () => {
    expect(shouldRunGlobalReset()).toBe(true);
  });

  describe("nested opted-in scope", () => {
    useGlobalReset();

    it("stays enabled while both the outer and inner scopes are active", () => {
      expect(shouldRunGlobalReset()).toBe(true);
    });
  });
});

// Runs after the `useGlobalReset wiring` suite's afterAll has fired. Vitest
// executes top-level describes in source order, so by the time this suite's
// tests run, the opted-in suite above has fully torn down — proving the
// afterAll drained the refcount back to zero rather than leaving it armed.
describe("useGlobalReset teardown", () => {
  it("drains the refcount back to zero after the opted-in suite exits", () => {
    expect(shouldRunGlobalReset()).toBe(false);
  });
});
