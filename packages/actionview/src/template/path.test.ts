import { describe, expect, test } from "vitest";

import { TemplatePath } from "./path.js";

describe("TemplatePath.virtual", () => {
  test("plain name with empty prefix", () => {
    expect(TemplatePath.virtual("show", "", false)).toBe("show");
  });

  test("partial name with empty prefix", () => {
    expect(TemplatePath.virtual("form", "", true)).toBe("_form");
  });

  test("name with prefix", () => {
    expect(TemplatePath.virtual("show", "users", false)).toBe("users/show");
  });

  test("partial name with prefix", () => {
    expect(TemplatePath.virtual("form", "users", true)).toBe("users/_form");
  });
});

describe("TemplatePath.parse", () => {
  test("parses name + prefix", () => {
    const p = TemplatePath.parse("users/show");
    expect(p.name).toBe("show");
    expect(p.prefix).toBe("users");
    expect(p.partial).toBe(false);
    expect(p.virtual).toBe("users/show");
  });

  test("parses partial", () => {
    const p = TemplatePath.parse("users/_form");
    expect(p.name).toBe("form");
    expect(p.prefix).toBe("users");
    expect(p.partial).toBe(true);
  });

  test("parses bare name (no prefix)", () => {
    const p = TemplatePath.parse("show");
    expect(p.name).toBe("show");
    expect(p.prefix).toBe("");
    expect(p.partial).toBe(false);
  });

  test("parses bare partial (no prefix)", () => {
    const p = TemplatePath.parse("_form");
    expect(p.name).toBe("form");
    expect(p.prefix).toBe("");
    expect(p.partial).toBe(true);
  });

  test("strips leading slash from prefix", () => {
    const p = TemplatePath.parse("/users/show");
    expect(p.prefix).toBe("users");
    expect(p.name).toBe("show");
  });

  test("nested prefix", () => {
    const p = TemplatePath.parse("admin/users/show");
    expect(p.prefix).toBe("admin/users");
    expect(p.name).toBe("show");
  });
});

describe("TemplatePath.build", () => {
  test("round-trips through virtual", () => {
    const p = TemplatePath.build("show", "users", false);
    expect(p.virtual).toBe("users/show");
    expect(p.toString()).toBe("users/show");
  });

  test("partial build", () => {
    const p = TemplatePath.build("form", "users", true);
    expect(p.virtual).toBe("users/_form");
  });
});

describe("TemplatePath equality", () => {
  test("equal when virtual matches", () => {
    const a = TemplatePath.parse("users/show");
    const b = TemplatePath.build("show", "users", false);
    expect(a.equals(b)).toBe(true);
  });

  test("unequal when virtual differs", () => {
    const a = TemplatePath.parse("users/show");
    const b = TemplatePath.parse("users/edit");
    expect(a.equals(b)).toBe(false);
  });
});
