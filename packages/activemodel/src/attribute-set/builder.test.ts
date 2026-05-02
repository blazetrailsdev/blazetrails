import { describe, it, expect } from "vitest";
import { Builder, LazyAttributeSet, LazyAttributeHash } from "./builder.js";
import { Attribute } from "../attribute.js";
import { typeRegistry } from "../type/registry.js";

describe("Builder", () => {
  const strType = typeRegistry.lookup("string");
  const intType = typeRegistry.lookup("integer");

  it("buildFromDatabase creates initialized attributes for present values", () => {
    const types = new Map([["name", strType]]);
    const builder = new Builder(types);
    const set = builder.buildFromDatabase({ name: "Alice" });
    expect(set.fetchValue("name")).toBe("Alice");
  });

  it("buildFromDatabase creates uninitialized attributes for absent values", () => {
    const types = new Map([["name", strType]]);
    const builder = new Builder(types);
    const set = builder.buildFromDatabase({});
    expect(set.getAttribute("name").isInitialized()).toBe(false);
  });
});

describe("LazyAttributeSet", () => {
  const strType = typeRegistry.lookup("string");
  const intType = typeRegistry.lookup("integer");

  it("additionalTypes returns the map passed at construction", () => {
    const extra = new Map([["score", intType]]);
    const lazy = new LazyAttributeSet(new Map(), extra);
    expect(lazy.additionalTypes()).toBe(extra);
  });

  it("materialize includes initialized attributes", () => {
    const attrs = new Map([["name", Attribute.fromDatabase("name", "Alice", strType)]]);
    const lazy = new LazyAttributeSet(attrs);
    const result = lazy.materialize();
    expect(result.get("name")).toBeDefined();
    expect(result.get("name")!.value).toBe("Alice");
  });

  it("materialize includes uninitialized attributes", () => {
    const attrs = new Map<string, Attribute>([
      ["name", Attribute.fromDatabase("name", "Alice", strType)],
      ["age", Attribute.uninitialized("age", intType)],
    ]);
    const lazy = new LazyAttributeSet(attrs);
    const result = lazy.materialize();
    expect(result.has("age")).toBe(true);
    expect(result.get("age")!.isInitialized()).toBe(false);
  });
});

describe("LazyAttributeHash", () => {
  const strType = typeRegistry.lookup("string");
  const intType = typeRegistry.lookup("integer");

  it("delegateHash returns an empty map before any access", () => {
    const hash = new LazyAttributeHash(new Map([["name", strType]]), {});
    expect(hash.delegateHash().size).toBe(0);
  });

  it("delegateHash reflects materialized entries after get", () => {
    const hash = new LazyAttributeHash(new Map([["name", strType]]), { name: "Bob" });
    hash.get("name");
    expect(hash.delegateHash().has("name")).toBe(true);
  });

  it("assignDefaultValue materializes from the value/type tables", () => {
    const hash = new LazyAttributeHash(new Map([["age", intType]]), { age: "42" });
    const attr = hash.assignDefaultValue("age");
    expect(attr.value).toBe(42);
  });

  it("assignDefaultValue returns Attribute.null for unknown names", () => {
    const hash = new LazyAttributeHash(new Map(), {});
    const attr = hash.assignDefaultValue("missing");
    expect(attr.value).toBeNull();
  });
});
