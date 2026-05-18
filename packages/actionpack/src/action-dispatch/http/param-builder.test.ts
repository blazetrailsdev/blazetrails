import { afterEach, describe, expect, test } from "vitest";
import { InvalidParameterError } from "@blazetrails/rack";
import { ParamBuilder } from "./param-builder.js";

describe("ParamBuilder", () => {
  // Much of the behavioral details are covered by long-standing
  // integration tests in test/request/query_string_parsing_test.rb
  //
  // This test doesn't need to duplicate all of that: it just
  // offers a simple baseline of unit tests.

  const previous = ParamBuilder.ignoreLeadingBrackets;
  afterEach(() => {
    ParamBuilder.ignoreLeadingBrackets = previous;
  });

  test("simple query string", () => {
    const result = ParamBuilder.fromQueryString("foo=bar&baz=quux");
    expect({ ...result }).toEqual({ foo: "bar", baz: "quux" });
  });

  test("nested parameters", () => {
    const result = ParamBuilder.fromQueryString("foo[bar]=baz");
    expect({ ...result, foo: { ...(result.foo as object) } }).toEqual({
      foo: { bar: "baz" },
    });
  });

  test("(rack 3) defaults to retaining leading bracket", () => {
    let result = ParamBuilder.fromQueryString("[foo]=bar");
    expect({ ...result }).toEqual({ "[foo]": "bar" });

    result = ParamBuilder.fromQueryString("[foo][bar]=baz");
    expect({ ...result, "[foo]": { ...(result["[foo]"] as object) } }).toEqual({
      "[foo]": { bar: "baz" },
    });
  });

  test("configured for strict brackets", () => {
    ParamBuilder.ignoreLeadingBrackets = false;

    let result = ParamBuilder.fromQueryString("[foo]=bar");
    expect({ ...result }).toEqual({ "[foo]": "bar" });

    result = ParamBuilder.fromQueryString("[foo][bar]=baz");
    expect({ ...result, "[foo]": { ...(result["[foo]"] as object) } }).toEqual({
      "[foo]": { bar: "baz" },
    });
  });

  test("invalid percent-encoding raises InvalidParameterError", () => {
    expect(() => ParamBuilder.fromQueryString("foo=%E0%A4%A")).toThrow(InvalidParameterError);
  });

  test("configured for ignoring leading brackets", () => {
    ParamBuilder.ignoreLeadingBrackets = true;

    let result = ParamBuilder.fromQueryString("[foo]=bar");
    expect({ ...result }).toEqual({ foo: "bar" });

    result = ParamBuilder.fromQueryString("[foo][bar]=baz");
    expect({ ...result, foo: { ...(result.foo as object) } }).toEqual({
      foo: { bar: "baz" },
    });
  });
});
