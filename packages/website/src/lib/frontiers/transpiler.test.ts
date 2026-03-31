import { describe, it, expect } from "vitest";
import { stripTypes } from "./transpiler.js";

describe("stripTypes (regex fallback)", () => {
  it("removes type annotations from parameters", () => {
    const result = stripTypes("function foo(x: string, y: number) {}");
    expect(result).not.toContain(": string");
    expect(result).not.toContain(": number");
    expect(result).toContain("function foo(x");
  });

  it("removes import type statements", () => {
    const result = stripTypes('import type { Foo } from "./foo.js";');
    expect(result.trim()).toBe("");
  });

  it("removes export type statements", () => {
    const result = stripTypes("export type Foo = string;");
    expect(result.trim()).toBe("");
  });

  it("removes as casts", () => {
    const result = stripTypes("const x = value as string;");
    expect(result).not.toContain("as string");
    expect(result).toContain("const x = value");
  });

  it("removes as const", () => {
    const result = stripTypes("const x = [1, 2] as const;");
    expect(result).not.toContain("as const");
  });

  it("removes interface declarations", () => {
    const result = stripTypes("interface Foo { bar: string; }");
    expect(result.trim()).toBe("");
  });

  it("removes non-null assertions", () => {
    const result = stripTypes("const x = obj!.prop;");
    expect(result).toContain("obj.prop");
    expect(result).not.toContain("obj!");
  });

  it("preserves regular code", () => {
    const code = `
async function main() {
  const result = await fetch("/api");
  console.log(result);
}
`;
    const result = stripTypes(code);
    expect(result).toContain("async function main()");
    expect(result).toContain("await fetch");
    expect(result).toContain("console.log");
  });

  it("handles mixed imports (removes type keyword)", () => {
    const result = stripTypes('import { type Foo, Bar } from "./mod.js";');
    expect(result).not.toContain("type Foo");
    expect(result).toContain("Bar");
  });

  it("preserves string content that looks like types", () => {
    const code = `const s = "type: string";`;
    const result = stripTypes(code);
    expect(result).toContain('"type: string"');
  });
});
