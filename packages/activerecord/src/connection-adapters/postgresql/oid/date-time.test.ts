import { DateTimeType } from "@blazetrails/activemodel";
import { describe, expect, it } from "vitest";

import { DateTime } from "./date-time.js";
import { Timestamp } from "./timestamp.js";
import { TimestampWithTimeZone } from "./timestamp-with-time-zone.js";

describe("PostgreSQL::OID::DateTime", () => {
  const type = new DateTime();

  it("extends Type::DateTime", () => {
    expect(type).toBeInstanceOf(DateTimeType);
  });

  it("casts 'infinity' / '-infinity' sentinels", () => {
    expect(type.cast("infinity")).toBe(Infinity);
    expect(type.cast("-infinity")).toBe(-Infinity);
  });

  it("rewrites BC-era timestamps with a biased year", () => {
    const result = type.cast("0044-03-15 12:00:00 BC");
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getUTCFullYear()).toBe(-43);
  });

  it("type_cast_for_schema renders infinity sentinels", () => {
    expect(type.typeCastForSchema(Infinity)).toBe("::Float::INFINITY");
    expect(type.typeCastForSchema(-Infinity)).toBe("-::Float::INFINITY");
  });
});

describe("PostgreSQL::OID::Timestamp", () => {
  it("extends OID::DateTime and reports :timestamp", () => {
    const type = new Timestamp();
    expect(type).toBeInstanceOf(DateTime);
    expect(type.type()).toBe("timestamp");
  });

  it("inherits infinity + BC handling from OID::DateTime", () => {
    expect(new Timestamp().cast("infinity")).toBe(Infinity);
  });
});

describe("PostgreSQL::OID::TimestampWithTimeZone", () => {
  it("extends OID::DateTime and reports :timestamptz", () => {
    const type = new TimestampWithTimeZone();
    expect(type).toBeInstanceOf(DateTime);
    expect(type.type()).toBe("timestamptz");
  });

  it("inherits infinity + BC handling from OID::DateTime", () => {
    expect(new TimestampWithTimeZone().cast("-infinity")).toBe(-Infinity);
  });
});
