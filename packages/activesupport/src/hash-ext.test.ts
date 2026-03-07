import { describe, it, expect } from "vitest";
import {
  deepMerge,
  deepTransformKeys,
  deepTransformValues,
  symbolizeKeys,
  stringifyKeys,
  deepSymbolizeKeys,
  deepStringifyKeys,
  reverseMerge,
  assertValidKeys,
  slice,
  except,
  extractKeys,
  toParam,
  compact,
  compactBlankObj,
} from "./hash-utils.js";

// ── HashExtTest ────────────────────────────────────────────────────────────────

describe("HashExtTest", () => {
  const strings = { a: 1, b: 2 };
  const symbols = { a: 1, b: 2 };  // in TS keys are always strings
  const mixed = { a: 1, b: 2 };

  it("deep_transform_keys — transforms all keys recursively", () => {
    const nested = { a: { b: { c: 3 } } };
    const result = deepTransformKeys(nested, (k) => k.toUpperCase());
    expect(result).toEqual({ A: { B: { C: 3 } } });
  });

  it("deep_transform_keys — handles array values", () => {
    const obj = { a: [{ b: 2 }, { c: 3 }, 4] };
    const result = deepTransformKeys(obj, (k) => k.toUpperCase());
    expect(result).toEqual({ A: [{ B: 2 }, { C: 3 }, 4] });
  });

  it("deep_transform_keys does not mutate original", () => {
    const original = { a: { b: 1 } };
    deepTransformKeys(original, (k) => k.toUpperCase());
    expect(original).toEqual({ a: { b: 1 } });
  });

  it("deep_transform_values — transforms all values recursively", () => {
    const obj = { a: 1, b: 2 };
    expect(deepTransformValues(obj, (v) => String(v))).toEqual({ a: "1", b: "2" });
  });

  it("deep_transform_values — nested", () => {
    const obj = { a: { b: { c: 3 } } };
    expect(deepTransformValues(obj, (v) => String(v))).toEqual({ a: { b: { c: "3" } } });
  });

  it("deep_transform_values — arrays", () => {
    const obj = { a: [{ b: 2 }, { c: 3 }, 4] };
    expect(deepTransformValues(obj, (v) => String(v))).toEqual({ a: [{ b: "2" }, { c: "3" }, "4"] });
  });

  it("deep_transform_values does not mutate original", () => {
    const original = { a: { b: 1 } };
    deepTransformValues(original, (v) => String(v));
    expect(original).toEqual({ a: { b: 1 } });
  });

  it("symbolize_keys — returns object with string keys (identity in TS)", () => {
    expect(symbolizeKeys({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("symbolize_keys does not mutate original", () => {
    const obj = { a: 1, b: 2 };
    symbolizeKeys(obj);
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it("deep_symbolize_keys — recursively normalizes keys", () => {
    const nested = { a: { b: { c: 3 } } };
    expect(deepSymbolizeKeys(nested)).toEqual({ a: { b: { c: 3 } } });
  });

  it("stringify_keys — converts keys to strings", () => {
    expect(stringifyKeys({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("stringify_keys does not mutate original", () => {
    const obj = { a: 1, b: 2 };
    stringifyKeys(obj);
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it("deep_stringify_keys — recursively converts keys", () => {
    const nested = { a: { b: { c: 3 } } };
    expect(deepStringifyKeys(nested)).toEqual({ a: { b: { c: 3 } } });
  });

  it("assert_valid_keys — passes for valid keys", () => {
    expect(() =>
      assertValidKeys({ failure: "stuff", funny: "business" }, ["failure", "funny"])
    ).not.toThrow();
  });

  it("assert_valid_keys — passes when not all valid keys present", () => {
    expect(() =>
      assertValidKeys({ failure: "stuff", funny: "business" }, ["failure", "funny", "sunny"])
    ).not.toThrow();
  });

  it("assert_valid_keys — throws on unknown key", () => {
    expect(() =>
      assertValidKeys({ failore: "stuff", funny: "business" }, ["failure", "funny"])
    ).toThrow(/Unknown key: failore/);
  });

  it("assert_valid_keys — includes valid keys in error message", () => {
    expect(() =>
      assertValidKeys({ failore: "stuff" }, ["failure"])
    ).toThrow(/Valid keys are: failure/);
  });

  it("deep_merge — merges nested objects", () => {
    const h1 = { a: "a", b: "b", c: { c1: "c1", c2: "c2", c3: { d1: "d1" } } };
    const h2 = { a: 1, c: { c1: 2, c3: { d2: "d2" } } };
    const expected = { a: 1, b: "b", c: { c1: 2, c2: "c2", c3: { d1: "d1", d2: "d2" } } };
    expect(deepMerge(h1, h2)).toEqual(expected);
  });

  it("deep_merge does not mutate original", () => {
    const target = { a: { b: 1 } };
    deepMerge(target, { a: { c: 2 } });
    expect(target).toEqual({ a: { b: 1 } });
  });

  it("reverse_merge — fills defaults without overwriting", () => {
    const defaults = { d: 0, a: "x", b: "y", c: 10 };
    const options = { a: 1, b: 2 };
    const expected = { d: 0, a: 1, b: 2, c: 10 };
    expect(reverseMerge(options, defaults)).toEqual(expected);
  });

  it("reverse_merge does not mutate options", () => {
    const options = { a: 1, b: 2 };
    reverseMerge(options, { b: 99, c: 10 });
    expect(options).toEqual({ a: 1, b: 2 });
  });

  it("slice — picks specified keys", () => {
    const original = { a: "x", b: "y", c: 10 };
    expect(slice(original, "a", "b")).toEqual({ a: "x", b: "y" });
  });

  it("except (except!) — removes specified keys", () => {
    const original = { a: "x", b: "y", c: 10 };
    expect(except(original, "c")).toEqual({ a: "x", b: "y" });
  });

  it("except with multiple keys", () => {
    const original = { a: "x", b: "y", c: 10 };
    expect(except(original, "b", "c")).toEqual({ a: "x" });
  });

  it("extract — removes and returns specified keys", () => {
    const original: Record<string, unknown> = { a: 1, b: 2, c: 3, d: 4 };
    const extracted = extractKeys(original, "a", "b");
    expect(extracted).toEqual({ a: 1, b: 2 });
    expect(original).toEqual({ c: 3, d: 4 });
  });

  it("extract nils — handles null values", () => {
    const original: Record<string, unknown> = { a: null, b: null };
    const extracted = extractKeys(original, "a", "x");
    expect(extracted).toEqual({ a: null });
    expect(original).toEqual({ b: null });
  });

  it("compact — removes null/undefined values", () => {
    const obj = { a: 1, b: null, c: undefined, d: 2 };
    expect(compact(obj)).toEqual({ a: 1, d: 2 });
  });

  it("compact — empty object stays empty", () => {
    expect(compact({})).toEqual({});
  });

  it("compact — object with no nils is unchanged", () => {
    expect(compact({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

// ── HashExtToParamTests ────────────────────────────────────────────────────────

describe("HashExtToParamTests", () => {
  it("empty hash returns empty string", () => {
    expect(toParam({})).toBe("");
  });

  it("simple string hash", () => {
    expect(toParam({ hello: "world" })).toBe("hello=world");
  });

  it("string hash with number value", () => {
    expect(toParam({ hello: 10 })).toBe("hello=10");
  });

  it("multiple keys are joined with &", () => {
    const result = toParam({ hello: "world", say_bye: true });
    expect(result).toContain("hello=world");
    expect(result).toContain("say_bye=true");
    expect(result).toContain("&");
  });

  it("number keys", () => {
    const result = toParam({ 10: 20, 30: 40, 50: 60 });
    expect(result).toContain("10=20");
    expect(result).toContain("30=40");
    expect(result).toContain("50=60");
  });

  it("encodes spaces and special chars", () => {
    const result = toParam({ "param 1": "A string with / characters" });
    expect(result).toContain("param");
    // encoded space
    expect(result).toMatch(/param[+%20]/);
  });

  it("keys sorted in ascending order", () => {
    const result = toParam({ b: 1, c: 0, a: 2 });
    expect(result).toBe("a=2&b=1&c=0");
  });

  it("compactBlankObj — removes blank values from object", () => {
    const values = { a: "", b: 1, c: null, d: [] as unknown[], e: false, f: true };
    expect(compactBlankObj(values)).toEqual({ b: 1, f: true });
  });
});
