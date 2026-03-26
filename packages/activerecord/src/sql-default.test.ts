import { describe, it, expect } from "vitest";
import { formatDefaultClause } from "./sql-default.js";

describe("formatDefaultClause", () => {
  it("returns empty string for undefined", () => {
    expect(formatDefaultClause(undefined)).toBe("");
  });

  it("returns DEFAULT NULL for null", () => {
    expect(formatDefaultClause(null)).toBe(" DEFAULT NULL");
  });

  it("returns DEFAULT TRUE/FALSE for booleans", () => {
    expect(formatDefaultClause(true)).toBe(" DEFAULT TRUE");
    expect(formatDefaultClause(false)).toBe(" DEFAULT FALSE");
  });

  it("returns unquoted numbers", () => {
    expect(formatDefaultClause(42)).toBe(" DEFAULT 42");
    expect(formatDefaultClause(3.14)).toBe(" DEFAULT 3.14");
  });

  it("quotes regular strings", () => {
    expect(formatDefaultClause("hello")).toBe(" DEFAULT 'hello'");
  });

  it("escapes single quotes in strings", () => {
    expect(formatDefaultClause("it's")).toBe(" DEFAULT 'it''s'");
  });

  it("does not quote CURRENT_TIMESTAMP", () => {
    expect(formatDefaultClause("CURRENT_TIMESTAMP")).toBe(" DEFAULT CURRENT_TIMESTAMP");
  });

  it("does not quote CURRENT_TIMESTAMP with precision", () => {
    expect(formatDefaultClause("CURRENT_TIMESTAMP(6)")).toBe(" DEFAULT CURRENT_TIMESTAMP(6)");
  });

  it("does not quote SQL function calls like now()", () => {
    expect(formatDefaultClause("now()")).toBe(" DEFAULT now()");
  });

  it("does not quote uuid_generate_v4()", () => {
    expect(formatDefaultClause("uuid_generate_v4()")).toBe(" DEFAULT uuid_generate_v4()");
  });

  it("supports function-style defaults", () => {
    expect(formatDefaultClause(() => "CURRENT_TIMESTAMP")).toBe(" DEFAULT CURRENT_TIMESTAMP");
  });
});
