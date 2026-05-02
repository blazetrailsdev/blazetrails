import { describe, it, expect } from "vitest";
import { Builder, LazyAttributeHash } from "./builder.js";
import { Attribute } from "../attribute.js";
import { typeRegistry } from "../type/registry.js";

describe("LazyAttributeHash defaultAttributes", () => {
  const strType = typeRegistry.lookup("string");
  const intType = typeRegistry.lookup("integer");

  it("returns the schema default attribute when key is in defaultAttributes but absent from values", () => {
    const types = new Map([["status", strType]]);
    const defaults = new Map([["status", Attribute.withCastValue("status", "active", strType)]]);
    const hash = new LazyAttributeHash(types, {}, new Map(), defaults);

    const attr = hash.get("status");
    expect(attr.value).toBe("active");
  });

  it("user-provided values override defaultAttributes", () => {
    const types = new Map([["status", strType]]);
    const defaults = new Map([["status", Attribute.withCastValue("status", "active", strType)]]);
    const hash = new LazyAttributeHash(types, { status: "archived" }, new Map(), defaults);

    expect(hash.get("status").value).toBe("archived");
  });

  it("returns Uninitialized when key is absent from both values and defaultAttributes", () => {
    const types = new Map([["age", intType]]);
    const hash = new LazyAttributeHash(types, {});

    expect(hash.get("age").isInitialized()).toBe(false);
  });

  it("materialized default is detached from the prototype — mutation does not bleed across AttributeSets", () => {
    const types = new Map([["status", strType]]);
    const defaultProto = Attribute.withCastValue("status", "active", strType);
    const defaults = new Map([["status", defaultProto]]);

    const builder = new Builder(types, defaults);
    const setA = builder.buildFromDatabase({});
    const setB = builder.buildFromDatabase({});

    setA.set("status", setA.getAttribute("status").withValueFromUser("mutated"));

    expect(setA.fetchValue("status")).toBe("mutated");
    expect(setB.fetchValue("status")).toBe("active");
    expect(defaultProto.value).toBe("active");
  });
});
