import { describe, it, expect, vi, beforeEach } from "vitest";
import { Deprecation, DeprecationError, deprecator } from "./deprecation.js";

describe("DeprecationTest", () => {
  let dep: Deprecation;

  beforeEach(() => {
    dep = new Deprecation();
  });

  it(":raise behavior", () => {
    dep.behavior = "raise";
    expect(() => dep.warn("old API")).toThrow(DeprecationError);
    expect(() => dep.warn("old API")).toThrow("old API");
  });

  it(":silence behavior", () => {
    dep.behavior = "silence";
    // Should not throw
    expect(() => dep.warn("something")).not.toThrow();
  });

  it(":stderr behavior writes to stderr", () => {
    dep.behavior = "stderr";
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    dep.warn("fubar");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("fubar"));
    spy.mockRestore();
  });

  it(":warn behavior writes to stderr", () => {
    dep.behavior = "warn";
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    dep.warn("fubar");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("fubar"));
    spy.mockRestore();
  });

  it("nil behavior is ignored", () => {
    dep.behavior = null;
    // Should not throw
    expect(() => dep.warn("fubar")).not.toThrow();
  });

  it("silence", () => {
    expect(dep.silenced).toBe(false);
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    dep.silence(() => {
      dep.warn("should be silent");
    });
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("silence returns the result of the block", () => {
    expect(dep.silence(() => 123)).toBe(123);
  });

  it("silence ensures silencing is reverted after an error is raised", () => {
    expect(() => {
      dep.silence(() => { throw new Error("oops"); });
    }).toThrow("oops");

    dep.behavior = "raise";
    expect(() => dep.warn("still active")).toThrow();
  });

  it("silenced=true suppresses all warnings", () => {
    dep.silenced = true;
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    dep.warn("should be silent");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("deprecateMethod wraps method with warning", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const obj = { greet: () => "hello" };
    dep.behavior = "stderr";
    dep.deprecateMethod(obj, "greet", "greet is deprecated");
    const result = obj.greet();
    expect(result).toBe("hello");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("greet is deprecated"));
    spy.mockRestore();
  });

  it("behavior as function callback", () => {
    const messages: string[] = [];
    dep.behavior = (msg: unknown) => { messages.push(String(msg)); };
    dep.warn("fubar");
    expect(messages.some((m) => m.includes("fubar"))).toBe(true);
  });

  it("behavior as array of behaviors", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    dep.behavior = ["stderr", "silence"];
    dep.warn("multi");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("warn with no message produces default message", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    dep.warn();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("DEPRECATION WARNING"));
    spy.mockRestore();
  });

  it("disallowed_warnings is empty by default", () => {
    expect(dep.disallowedWarnings).toEqual([]);
  });

  it("disallowed_warnings can be configured", () => {
    const warnings = ["unsafe_method is going away"];
    dep.disallowedWarnings = warnings;
    expect(dep.disallowedWarnings).toEqual(warnings);
  });

  it("deprecator singleton is a Deprecation instance", () => {
    expect(deprecator).toBeInstanceOf(Deprecation);
  });

  it("gem option stored on instance", () => {
    const d = new Deprecation({ gem: "MyGem" });
    expect(d.gem).toBe("MyGem");
  });

  it("horizon option stored on instance", () => {
    const d = new Deprecation({ horizon: "3.0" });
    expect(d.horizon).toBe("3.0");
  });

  it("silenced option in constructor", () => {
    const d = new Deprecation({ silenced: true });
    expect(d.silenced).toBe(true);
  });
});
