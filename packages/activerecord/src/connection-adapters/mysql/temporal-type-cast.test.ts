import { describe, it, expect } from "vitest";
import { Temporal } from "@blazetrails/activesupport/temporal";
import { temporalTypeCast } from "./temporal-type-cast.js";

// mysql2 field type IDs (mirrors the values in temporal-type-cast.ts)
const TYPE_TIMESTAMP = 7;
const TYPE_DATE = 10;
const TYPE_TIME = 11;
const TYPE_DATETIME = 12;
const TYPE_NEWDATE = 14;
const TYPE_TIMESTAMP2 = 17; // binary protocol variant for TIMESTAMP(N)
const TYPE_DATETIME2 = 18; // binary protocol variant for DATETIME(N)
const TYPE_TIME2 = 19; // binary protocol variant for TIME(N)
const TYPE_VARCHAR = 253;

function field(type: number, value: string | null) {
  return { type, string: () => value };
}
const next = () => "next-called";

describe("temporalTypeCast", () => {
  describe("TIMESTAMP (type 7)", () => {
    it("parses a UTC timestamp to Temporal.Instant", () => {
      const result = temporalTypeCast(field(TYPE_TIMESTAMP, "2026-04-27 14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.Instant);
      expect((result as Temporal.Instant).epochMilliseconds).toBe(
        Temporal.Instant.from("2026-04-27T14:23:55.123456Z").epochMilliseconds,
      );
    });

    it("preserves microsecond precision", () => {
      const result = temporalTypeCast(field(TYPE_TIMESTAMP, "2026-01-01 00:00:00.000001"), next);
      expect(result).toBeInstanceOf(Temporal.Instant);
      expect((result as Temporal.Instant).epochNanoseconds % 1000000000n).toBe(1000n);
    });

    it("returns null for NULL", () => {
      expect(temporalTypeCast(field(TYPE_TIMESTAMP, null), next)).toBeNull();
    });
  });

  describe("DATETIME (type 12) / NEWDATE (type 14)", () => {
    it("parses DATETIME to Temporal.PlainDateTime", () => {
      const result = temporalTypeCast(field(TYPE_DATETIME, "2026-04-27 14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.PlainDateTime);
      // .123456 s → millisecond=123, microsecond=456 (sub-ms component)
      expect((result as Temporal.PlainDateTime).millisecond).toBe(123);
      expect((result as Temporal.PlainDateTime).microsecond).toBe(456);
    });

    it("returns null for zero-date", () => {
      expect(temporalTypeCast(field(TYPE_DATETIME, "0000-00-00 00:00:00"), next)).toBeNull();
    });

    it("handles NEWDATE type", () => {
      const result = temporalTypeCast(field(TYPE_NEWDATE, "2026-04-27 00:00:00"), next);
      expect(result).toBeInstanceOf(Temporal.PlainDateTime);
    });

    it("returns null for NULL", () => {
      expect(temporalTypeCast(field(TYPE_DATETIME, null), next)).toBeNull();
    });
  });

  describe("DATE (type 10)", () => {
    it("parses DATE to Temporal.PlainDate", () => {
      const result = temporalTypeCast(field(TYPE_DATE, "2026-04-27"), next);
      expect(result).toBeInstanceOf(Temporal.PlainDate);
      expect((result as Temporal.PlainDate).toString()).toBe("2026-04-27");
    });

    it("returns null for zero-date", () => {
      expect(temporalTypeCast(field(TYPE_DATE, "0000-00-00"), next)).toBeNull();
    });

    it("returns null for NULL", () => {
      expect(temporalTypeCast(field(TYPE_DATE, null), next)).toBeNull();
    });
  });

  describe("TIME (type 11)", () => {
    it("parses TIME to Temporal.PlainTime", () => {
      const result = temporalTypeCast(field(TYPE_TIME, "14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.PlainTime);
      const pt = result as Temporal.PlainTime;
      expect(pt.millisecond).toBe(123);
      expect(pt.microsecond).toBe(456);
    });

    it("returns null for NULL", () => {
      expect(temporalTypeCast(field(TYPE_TIME, null), next)).toBeNull();
    });
  });

  describe("binary protocol variants (prepared statements)", () => {
    it("TIMESTAMP2 (type 17) parses to Temporal.Instant", () => {
      const result = temporalTypeCast(field(TYPE_TIMESTAMP2, "2026-04-27 14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.Instant);
    });

    it("DATETIME2 (type 18) parses to Temporal.PlainDateTime", () => {
      const result = temporalTypeCast(field(TYPE_DATETIME2, "2026-04-27 14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.PlainDateTime);
    });

    it("TIME2 (type 19) parses to Temporal.PlainTime", () => {
      const result = temporalTypeCast(field(TYPE_TIME2, "14:23:55.123456"), next);
      expect(result).toBeInstanceOf(Temporal.PlainTime);
    });
  });

  describe("non-temporal types", () => {
    it("delegates to next() for VARCHAR", () => {
      expect(temporalTypeCast(field(TYPE_VARCHAR, "hello"), next)).toBe("next-called");
    });
  });
});
