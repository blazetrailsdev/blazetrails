import { DateType } from "@blazetrails/activemodel";
import { describe, expect, it } from "vitest";

import { Date as OidDate } from "./date.js";

describe("PostgreSQL::OID::Date", () => {
  const type = new OidDate();

  it("extends Type::Date", () => {
    expect(type).toBeInstanceOf(DateType);
  });

  it("casts 'infinity' to Float::INFINITY", () => {
    expect(type.cast("infinity")).toBe(Infinity);
  });

  it("casts '-infinity' to -Float::INFINITY", () => {
    expect(type.cast("-infinity")).toBe(-Infinity);
  });

  it("rewrites BC-era dates with a biased year and delegates to super", () => {
    // "0044-03-15 BC" → year -43 (Ides of March, 44 BC). Rails uses
    // -year+1 so 0001 BC → 0000, 0044 BC → -0043.
    const result = type.cast("0044-03-15 BC");
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(-43);
  });

  it("type_cast_for_schema renders the infinity sentinels", () => {
    expect(type.typeCastForSchema(Infinity)).toBe("::Float::INFINITY");
    expect(type.typeCastForSchema(-Infinity)).toBe("-::Float::INFINITY");
  });
});
