import { describe, it, expect, vi, afterEach } from "vitest";
import { AttributeSetCoder, AttributeSetCoderError } from "./coder.js";
import type { AttributeSetCodec, AttributeSetEnvelope } from "./coder.js";
import { AttributeSet } from "../attribute-set.js";
import { Attribute } from "../attribute.js";
import { typeRegistry } from "../type/registry.js";

function makeSet(attrs: Map<string, Attribute>): AttributeSet {
  return new AttributeSet(attrs);
}

function stringAttr(name: string, value: string): Attribute {
  return Attribute.fromUser(name, value, typeRegistry.lookup("string"));
}

function intAttr(name: string, value: number): Attribute {
  return Attribute.fromUser(name, value, typeRegistry.lookup("integer"));
}

describe("AttributeSetCoder", () => {
  const coder = new AttributeSetCoder(typeRegistry);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trips a simple set", () => {
    const attrs = new Map([
      ["name", stringAttr("name", "Alice")],
      ["age", intAttr("age", 30)],
    ]);
    const set = makeSet(attrs);
    const decoded = coder.decode(coder.encode(set));
    expect(decoded.fetchValue("name")).toBe("Alice");
    expect(decoded.fetchValue("age")).toBe(30);
  });

  it("uninitialized attributes round-trip via defaultAttributes", () => {
    const uninit = Attribute.uninitialized("score", typeRegistry.lookup("integer"));
    const attrs = new Map<string, Attribute>([["score", uninit]]);
    const set = makeSet(attrs);
    const encoded = coder.encode(set);
    const envelope = JSON.parse(encoded);
    expect(envelope.defaultAttributes).toContain("score");
  });

  it("unknown type key falls back to value type and warns once", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const localCoder = new AttributeSetCoder(typeRegistry);
    const json = JSON.stringify({
      v: 1,
      types: { x: "unknown_type_xyz" },
      values: { x: "hello" },
    });
    const decoded = localCoder.decode(json);
    expect(decoded.fetchValue("x")).toBe("hello");
    expect(warnSpy).toHaveBeenCalledOnce();
    // Second decode: no extra warn
    localCoder.decode(json);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("silenceDriftWarnings suppresses the console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const silentCoder = new AttributeSetCoder(typeRegistry, {
      silenceDriftWarnings: true,
    });
    const json = JSON.stringify({
      v: 1,
      types: { y: "completely_unknown_type_abc" },
      values: { y: 1 },
    });
    silentCoder.decode(json);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("v mismatch throws AttributeSetCoderError", () => {
    const json = JSON.stringify({ v: 2, types: {}, values: {} });
    expect(() => coder.decode(json)).toThrow(AttributeSetCoderError);
    expect(() => coder.decode(json)).toThrow("v=2 not supported");
  });

  it("attr in envelope but not in schema is kept as additional", () => {
    const schema = new Map<string, Attribute>([["name", stringAttr("name", "Bob")]]);
    const json = JSON.stringify({
      v: 1,
      types: { name: "string", extra: "string" },
      values: { name: "Bob", extra: "bonus" },
    });
    const decoded = coder.decode(json, schema);
    expect(decoded.fetchValue("extra")).toBe("bonus");
  });

  it("uses attr.type.name (registry key) not type() for type storage", () => {
    // ImmutableStringType.type() returns "string" (Rails API alias) but
    // name = "immutable_string" (registry key). Encode must store the key.
    const immutableType = typeRegistry.lookup("immutable_string");
    const attr = Attribute.fromUser("flag", "t", immutableType);
    const set = makeSet(new Map([["flag", attr]]));
    const envelope = JSON.parse(coder.encode(set));
    expect(envelope.types.flag).toBe("immutable_string");
    // Decode recovers the correct type
    const decoded = coder.decode(coder.encode(set));
    expect(decoded.fetchValue("flag")).toBe("t");
  });

  it("delegates encode/decode through an injected custom codec", () => {
    const encoded: AttributeSetEnvelope[] = [];
    const customCodec: AttributeSetCodec = {
      encode: vi.fn((env: AttributeSetEnvelope) => {
        encoded.push(env);
        return JSON.stringify(env);
      }),
      decode: vi.fn((input: string) => JSON.parse(input) as AttributeSetEnvelope),
    };
    const customCoder = new AttributeSetCoder(typeRegistry, { codec: customCodec });
    const set = makeSet(new Map([["x", stringAttr("x", "hi")]]));
    customCoder.decode(customCoder.encode(set));
    expect(customCodec.encode).toHaveBeenCalledOnce();
    expect(customCodec.decode).toHaveBeenCalledOnce();
    expect(encoded[0].types.x).toBe("string");
  });

  it("schema attr not in envelope resolves to Uninitialized", () => {
    const schema = new Map<string, Attribute>([
      ["name", stringAttr("name", "Bob")],
      ["missing", Attribute.uninitialized("missing", typeRegistry.lookup("string"))],
    ]);
    const json = JSON.stringify({
      v: 1,
      types: { name: "string" },
      values: { name: "Bob" },
    });
    const decoded = coder.decode(json, schema);
    expect(decoded.has("missing")).toBe(false);
  });
});
