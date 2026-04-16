import { describe, expect, it } from "vitest";
import { Array as OidArray, Data } from "./array.js";

const stringSubtype = {
  cast: (value: unknown) => (value == null ? null : String(value)),
  serialize: (value: unknown) => (value == null ? null : String(value)),
  deserialize: (value: unknown) => (value == null ? null : String(value)),
  typeCastForSchema: (value: unknown) => JSON.stringify(value),
};

describe("PostgreSQL::OID::Array", () => {
  it("serialize returns Data with encoder and casted values", () => {
    const type = new OidArray(stringSubtype);
    const data = type.serialize(["a", "b"]) as Data;

    expect(data).toBeInstanceOf(Data);
    expect(data.encoder).toBe(type);
    expect(data.values).toEqual(["a", "b"]);
    expect(String(data)).toBe("{a,b}");
  });

  it("typeCastForSchema formats array elements through the subtype", () => {
    const type = new OidArray(stringSubtype);

    expect(type.typeCastForSchema(["a", "b"])).toBe('["a", "b"]');
  });

  it("map delegates non-array values to subtype map when present", () => {
    const type = new OidArray({
      ...stringSubtype,
      map: (value: unknown, block?: (value: unknown) => unknown) => block?.(`mapped:${value}`),
    });

    expect(type.map("x", (value) => `${value}!`)).toBe("mapped:x!");
  });

  it("detects changed in-place arrays by deserializing the raw value", () => {
    const type = new OidArray(stringSubtype);

    expect(type.isChangedInPlace("{a,b}", ["a", "b"])).toBe(false);
    expect(type.isChangedInPlace("{a,b}", ["a", "c"])).toBe(true);
  });

  it("forces equality for array values", () => {
    const type = new OidArray(stringSubtype);

    expect(type.isForceEquality(["a"])).toBe(true);
    expect(type.isForceEquality("a")).toBe(false);
  });
});
