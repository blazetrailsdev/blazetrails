import { describe, it, expect } from "vitest";
import {
  LocationParsingError,
  findOffset,
  sourceLines,
  tokenizeLine,
  translateLocation,
} from "./tse-translate-location.js";

describe("sourceLines", () => {
  it("matches Ruby's String#lines (keeps trailing separators)", () => {
    expect(sourceLines("a\nb\nc")).toEqual(["a\n", "b\n", "c"]);
    expect(sourceLines("a\nb\n")).toEqual(["a\n", "b\n"]);
    expect(sourceLines("")).toEqual([]);
  });
});

describe("tokenizeLine", () => {
  it("yields CODE for tag contents and TEXT for static spans", () => {
    expect(tokenizeLine("hi <%= name %>!")).toEqual([
      { kind: "TEXT", value: "hi " },
      { kind: "CODE", value: " name " },
      { kind: "TEXT", value: "!" },
    ]);
  });

  it("strips the trim `-` markers from CODE bounds", () => {
    expect(tokenizeLine("<%- x -%>")).toEqual([{ kind: "CODE", value: " x " }]);
  });

  it("returns an empty token list for a line with no tags and no text", () => {
    expect(tokenizeLine("")).toEqual([]);
  });
});

describe("findOffset", () => {
  it("returns the source-line column for a CODE token matched in compiled output", () => {
    // Rails' offset_source_tokens accumulates byte lengths of CODE/TEXT
    // contents only — so the returned column is relative to the concatenated
    // visible token content, not to the original source line (delimiters like
    // `<%=` / `%>` are excluded from the accounting). Here the single CODE
    // token has value " name "; column 1 points at the 'n'.
    const tokens = tokenizeLine("<%= name %>");
    const compiled = "_ob.append( name );";
    const errorColumn = compiled.indexOf("name");
    expect(findOffset(compiled, tokens, errorColumn)).toBe(1);
  });

  it("throws LocationParsingError when no anchor is found", () => {
    expect(() => findOffset("nothing here", tokenizeLine("<%= x %>"), 0)).toThrow(
      LocationParsingError,
    );
  });
});

describe("translateLocation", () => {
  it("mutates and returns the spot on success", () => {
    const source = "line1\n<%= value %>\n";
    const spot = {
      snippet: "_ob.append( value );",
      firstLineno: 2,
      lastLineno: 2,
      firstColumn: 12,
      lastColumn: 16,
    };
    const out = translateLocation(spot, { lineno: 2 }, source);
    expect(out).toBe(spot);
    expect(out!.scriptLines).toEqual(["line1\n", "<%= value %>\n"]);
  });

  it("returns null when the backtrace line exceeds source line count", () => {
    expect(
      translateLocation(
        { snippet: "x", firstLineno: 1, lastLineno: 1, firstColumn: 0, lastColumn: 0 },
        { lineno: 5 },
        "only\none\n",
      ),
    ).toBeNull();
  });

  it("returns null when find_offset throws LocationParsingError", () => {
    expect(
      translateLocation(
        { snippet: "no-match", firstLineno: 1, lastLineno: 1, firstColumn: 0, lastColumn: 0 },
        { lineno: 1 },
        "<%= x %>",
      ),
    ).toBeNull();
  });
});
