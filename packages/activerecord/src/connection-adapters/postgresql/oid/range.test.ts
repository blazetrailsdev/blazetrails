import { describe, expect, it } from "vitest";
import { Range } from "./range.js";

const integerSubtype = {
  cast: (value: unknown) => (value == null ? null : Number(value)),
  serialize: (value: unknown) => (value == null ? null : Number(value)),
  deserialize: (value: unknown) => (value == null ? null : Number(value)),
};

describe("PostgreSQL::OID::Range", () => {
  it("can still represent query range values", () => {
    const range = new Range(1, 10, true);

    expect(range.begin).toBe(1);
    expect(range.end).toBe(10);
    expect(range.excludeEnd).toBe(true);
  });

  it("casts PostgreSQL range strings through the subtype", () => {
    const type = new Range(integerSubtype, "int4range");
    const range = type.castValue("[1,10)")!;

    expect(range.begin).toBe(1);
    expect(range.end).toBe(10);
    expect(range.excludeEnd).toBe(true);
  });

  it("raises for excluded finite starts", () => {
    const type = new Range(integerSubtype, "int4range");

    expect(() => type.castValue("(1,10]")).toThrow(/excluding the beginning/);
  });

  it("serializes range bounds through the subtype", () => {
    const type = new Range(integerSubtype, "int4range");
    const range = type.serialize(new Range("1", "10", false))!;

    expect(range.begin).toBe(1);
    expect(range.end).toBe(10);
    expect(range.excludeEnd).toBe(false);
  });

  it("maps range bounds", () => {
    const type = new Range(integerSubtype, "int4range");
    const range = type.map(new Range(1, 10), (value) => Number(value) + 1);

    expect(range.begin).toBe(2);
    expect(range.end).toBe(11);
  });

  it("forces equality for range values", () => {
    const type = new Range(integerSubtype, "int4range");

    expect(type.isForceEquality(new Range(1, 10))).toBe(true);
    expect(type.isForceEquality([1, 10])).toBe(false);
  });
});
