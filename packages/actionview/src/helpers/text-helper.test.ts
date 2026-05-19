import { describe, expect, it } from "vitest";
import { htmlSafe } from "@blazetrails/activesupport";
import { OutputBuffer } from "../buffers.js";
import {
  Cycle,
  concat,
  currentCycle,
  cycle,
  resetCycle,
  safeConcat,
  type TextHelperHost,
} from "./text-helper.js";

function newHost(): TextHelperHost {
  return { outputBuffer: new OutputBuffer() };
}

describe("Cycle", () => {
  it("cycles through values via toString", () => {
    const c = new Cycle("a", "b", "c");
    expect(c.toString()).toBe("a");
    expect(c.toString()).toBe("b");
    expect(c.toString()).toBe("c");
    expect(c.toString()).toBe("a");
  });

  it("currentValue returns previously emitted value without advancing", () => {
    const c = new Cycle("x", "y");
    c.toString();
    expect(c.currentValue()).toBe("x");
    expect(c.currentValue()).toBe("x");
    c.toString();
    expect(c.currentValue()).toBe("y");
  });

  it("reset rewinds the index", () => {
    const c = new Cycle("1", "2", "3");
    c.toString();
    c.toString();
    c.reset();
    expect(c.toString()).toBe("1");
  });

  it("stringifies non-string values", () => {
    const c = new Cycle(1, 2);
    expect(c.toString()).toBe("1");
    expect(c.toString()).toBe("2");
  });
});

describe("cycle()", () => {
  it("returns alternating strings on repeated calls", () => {
    const host = newHost();
    expect(cycle.call(host, "odd", "even")).toBe("odd");
    expect(cycle.call(host, "odd", "even")).toBe("even");
    expect(cycle.call(host, "odd", "even")).toBe("odd");
  });

  it("supports named cycles independently", () => {
    const host = newHost();
    expect(cycle.call(host, "a", "b", { name: "row" })).toBe("a");
    expect(cycle.call(host, "red", "green", "blue", { name: "color" })).toBe("red");
    expect(cycle.call(host, "a", "b", { name: "row" })).toBe("b");
    expect(cycle.call(host, "red", "green", "blue", { name: "color" })).toBe("green");
  });

  it("accepts an array as the first argument", () => {
    const host = newHost();
    expect(cycle.call(host, ["a", "b"])).toBe("a");
    expect(cycle.call(host, ["a", "b"])).toBe("b");
  });

  it("resets when values change", () => {
    const host = newHost();
    expect(cycle.call(host, "a", "b")).toBe("a");
    expect(cycle.call(host, "x", "y")).toBe("x");
  });
});

describe("currentCycle()", () => {
  it("returns the most recently emitted value", () => {
    const host = newHost();
    cycle.call(host, "a", "b");
    expect(currentCycle.call(host)).toBe("a");
    cycle.call(host, "a", "b");
    expect(currentCycle.call(host)).toBe("b");
  });

  it("returns undefined for an unstarted cycle", () => {
    expect(currentCycle.call(newHost(), "missing")).toBeUndefined();
  });
});

describe("resetCycle()", () => {
  it("rewinds a named cycle", () => {
    const host = newHost();
    cycle.call(host, "a", "b", "c");
    cycle.call(host, "a", "b", "c");
    resetCycle.call(host);
    expect(cycle.call(host, "a", "b", "c")).toBe("a");
  });

  it("is a no-op when the cycle does not exist", () => {
    expect(() => resetCycle.call(newHost(), "nope")).not.toThrow();
  });
});

describe("concat()", () => {
  it("appends a string to the output buffer", () => {
    const host = newHost();
    concat.call(host, "hello");
    concat.call(host, " world");
    expect(host.outputBuffer.toStr()).toBe("hello world");
  });

  it("escapes unsafe input", () => {
    const host = newHost();
    concat.call(host, "<b>");
    expect(host.outputBuffer.toStr()).toBe("&lt;b&gt;");
  });
});

describe("safeConcat()", () => {
  it("appends without escaping", () => {
    const host = newHost();
    safeConcat.call(host, "<b>hi</b>");
    expect(host.outputBuffer.toStr()).toBe("<b>hi</b>");
  });

  it("appends html-safe SafeBuffer values", () => {
    const host = newHost();
    safeConcat.call(host, htmlSafe("<i>x</i>"));
    expect(host.outputBuffer.toStr()).toBe("<i>x</i>");
  });
});
