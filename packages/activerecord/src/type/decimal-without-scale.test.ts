import { BigIntegerType } from "@blazetrails/activemodel";
import { describe, expect, it } from "vitest";
import { DecimalWithoutScale } from "./decimal-without-scale.js";

describe("DecimalWithoutScale", () => {
  it("inherits from BigIntegerType", () => {
    expect(new DecimalWithoutScale()).toBeInstanceOf(BigIntegerType);
  });

  it("reports type as decimal", () => {
    const type = new DecimalWithoutScale();
    expect(type.type()).toBe("decimal");
    expect(type.name).toBe("decimal");
  });

  it("casts integer strings", () => {
    const type = new DecimalWithoutScale();
    expect(type.cast("42")).toBe(42n);
    expect(type.cast("-7")).toBe(-7n);
    expect(type.cast("")).toBeNull();
  });

  it("casts numbers by truncating", () => {
    const type = new DecimalWithoutScale();
    expect(type.cast(3.9)).toBe(3n);
    expect(type.cast(-3.9)).toBe(-3n);
  });

  it("accepts large values beyond 32-bit range without truncation", () => {
    const type = new DecimalWithoutScale();
    // Values above 2^31-1 that would be silently truncated by 4-byte IntegerType
    expect(type.cast("2147483648")).toBe(2147483648n);
    expect(type.cast("9999999999")).toBe(9999999999n);
  });

  it("typeCastForSchema quotes the value as a string", () => {
    const type = new DecimalWithoutScale();
    expect(type.typeCastForSchema("1.5")).toBe('"1.5"');
    expect(type.typeCastForSchema(null)).toBe('""');
    expect(type.typeCastForSchema(undefined)).toBe('""');
  });
});
