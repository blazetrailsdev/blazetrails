import { describe, it, expect } from "vitest";
import { ColumnSerializer } from "./column-serializer.js";
import { JSON as JsonCoder } from "./json.js";
import { SerializationTypeMismatch } from "../errors.js";

describe("ColumnSerializerTest", () => {
  it("dump returns nil for nil", () => {
    const cs = new ColumnSerializer("attr", JsonCoder);
    expect(cs.dump(null)).toBeUndefined();
  });

  it("dump serializes valid object", () => {
    const cs = new ColumnSerializer("attr", JsonCoder);
    const result = cs.dump({ a: 1 });
    expect(typeof result).toBe("string");
  });

  it("load returns null for nil payload with Object class", () => {
    const cs = new ColumnSerializer("attr", JsonCoder);
    expect(cs.load(null)).toBeNull();
  });

  it("load returns new instance for nil payload with custom class", () => {
    class MyList {
      items: unknown[] = [];
    }
    const cs = new ColumnSerializer("attr", JsonCoder, MyList);
    const result = cs.load(null);
    expect(result).toBeInstanceOf(MyList);
  });

  it("assert_valid_value raises SerializationTypeMismatch on wrong class", () => {
    class MyList {
      items: unknown[] = [];
    }
    const cs = new ColumnSerializer("attr", JsonCoder, MyList);
    expect(() => cs.assertValidValue("not a list", "dump")).toThrow(SerializationTypeMismatch);
  });

  it("check_arity_of_constructor raises for classes requiring args", () => {
    class RequiresArg {
      constructor(required: string) {
        if (!required) throw new Error("required");
      }
    }
    expect(() => new ColumnSerializer("attr", JsonCoder, RequiresArg as any)).toThrow(TypeError);
  });
});
