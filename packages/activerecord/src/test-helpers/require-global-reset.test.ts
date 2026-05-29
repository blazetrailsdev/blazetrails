import { describe, it, expect, afterEach } from "vitest";
import {
  popRequireGlobalReset,
  pushRequireGlobalReset,
  shouldRunGlobalReset,
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
