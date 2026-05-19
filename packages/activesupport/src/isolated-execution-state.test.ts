import { describe, expect, it, beforeEach } from "vitest";
import { IsolatedExecutionState } from "./isolated-execution-state.js";

describe("IsolatedExecutionState", () => {
  beforeEach(() => IsolatedExecutionState.clear());

  it("get/set/has/delete on the fallback (no scope)", () => {
    expect(IsolatedExecutionState.has("k")).toBe(false);
    IsolatedExecutionState.set("k", 1);
    expect(IsolatedExecutionState.get<number>("k")).toBe(1);
    expect(IsolatedExecutionState.has("k")).toBe(true);
    IsolatedExecutionState.delete("k");
    expect(IsolatedExecutionState.has("k")).toBe(false);
  });

  it("fetch initializes once", () => {
    let n = 0;
    const a = IsolatedExecutionState.fetch("singleton", () => ++n);
    const b = IsolatedExecutionState.fetch("singleton", () => ++n);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("run isolates state from outer context", async () => {
    IsolatedExecutionState.set("outer", "A");
    await IsolatedExecutionState.run(async () => {
      expect(IsolatedExecutionState.get("outer")).toBeUndefined();
      IsolatedExecutionState.set("inner", "B");
      expect(IsolatedExecutionState.get("inner")).toBe("B");
    });
    expect(IsolatedExecutionState.get("outer")).toBe("A");
    expect(IsolatedExecutionState.get("inner")).toBeUndefined();
  });
});
