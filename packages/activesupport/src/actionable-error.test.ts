import { describe, it, expect } from "vitest";
import { ActionableError, NonActionable } from "./actionable-error.js";

class TestError extends ActionableError {
  static override _actions: Record<string, () => void> = {};
}

describe("ActionableErrorTest", () => {
  it("returns all action of an actionable error", () => {
    let called = false;
    TestError.action("Do something", () => {
      called = true;
    });
    const actions = ActionableError.actions(new TestError());
    expect(Object.keys(actions)).toContain("Do something");
  });

  it("returns no actions for non-actionable errors", () => {
    const actions = ActionableError.actions(new Error("plain"));
    expect(Object.keys(actions)).toHaveLength(0);
  });

  it("dispatches actions from error and name", () => {
    let dispatched = false;
    TestError._actions = {};
    TestError.action("Fix it", () => {
      dispatched = true;
    });
    ActionableError.dispatch(new TestError(), "Fix it");
    expect(dispatched).toBe(true);
  });

  it("cannot dispatch missing actions", () => {
    TestError._actions = {};
    expect(() => {
      ActionableError.dispatch(new TestError(), "Nonexistent");
    }).toThrow(NonActionable);
  });
});
