import { describe, it, expect } from "vitest";
import { rubyInspect, rubyInspectArray } from "./ruby-inspect.js";

describe("rubyInspect", () => {
  it("renders nil / undefined as 'nil'", () => {
    expect(rubyInspect(null)).toBe("nil");
    expect(rubyInspect(undefined)).toBe("nil");
  });

  it("renders booleans as 'true' / 'false'", () => {
    expect(rubyInspect(true)).toBe("true");
    expect(rubyInspect(false)).toBe("false");
  });

  it("renders numbers bare (no quotes)", () => {
    expect(rubyInspect(42)).toBe("42");
    expect(rubyInspect(3.14)).toBe("3.14");
    expect(rubyInspect(-7)).toBe("-7");
  });

  it("renders bigints as their decimal string (matches Ruby's Integer#inspect)", () => {
    expect(rubyInspect(BigInt("9007199254740993"))).toBe("9007199254740993");
  });

  it('renders strings with double-quotes, escaping embedded " and \\', () => {
    expect(rubyInspect("foo")).toBe('"foo"');
    expect(rubyInspect('he said "hi"')).toBe('"he said \\"hi\\""');
    expect(rubyInspect("back\\slash")).toBe('"back\\\\slash"');
  });

  it("rubyInspectArray joins with ', ' and wraps in []", () => {
    expect(rubyInspectArray([1, "foo", null])).toBe('[1, "foo", nil]');
    expect(rubyInspectArray([])).toBe("[]");
    expect(rubyInspectArray([true, false, 0])).toBe("[true, false, 0]");
  });

  it("handles nested arrays", () => {
    expect(
      rubyInspectArray([
        [1, 2],
        ["a", "b"],
      ]),
    ).toBe('[[1, 2], ["a", "b"]]');
  });
});
