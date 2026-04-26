/**
 * Precision round-trip tests for the Temporal SQL formatters introduced in PR 2.
 * Verifies that sub-millisecond precision is preserved end-to-end through the
 * format functions that feed both the text-protocol (quote) and bind paths.
 */

import { describe, expect, it } from "vitest";
import { Temporal } from "@blazetrails/activesupport/temporal";
import {
  formatInstantForSql,
  formatPlainDateTimeForSql,
  formatPlainDateForSql,
  formatPlainTimeForSql,
} from "./quoting.js";
import { temporalToBindString } from "./database-statements.js";

describe("formatInstantForSql", () => {
  it("formats a whole-second instant", () => {
    const v = Temporal.Instant.from("2026-04-26T14:23:55Z");
    expect(formatInstantForSql(v)).toBe("2026-04-26 14:23:55");
  });

  it("preserves millisecond precision", () => {
    const v = Temporal.Instant.from("2026-04-26T14:23:55.123Z");
    expect(formatInstantForSql(v)).toBe("2026-04-26 14:23:55.123");
  });

  it("preserves microsecond precision", () => {
    const v = Temporal.Instant.from("2026-04-26T14:23:55.123456Z");
    expect(formatInstantForSql(v)).toBe("2026-04-26 14:23:55.123456");
  });

  it("preserves nanosecond precision", () => {
    const v = Temporal.Instant.from("2026-04-26T14:23:55.123456789Z");
    expect(formatInstantForSql(v)).toBe("2026-04-26 14:23:55.123456789");
  });

  it("preserves the smallest possible non-zero value (1 µs)", () => {
    const v = Temporal.Instant.from("2024-01-01T00:00:00.000001Z");
    expect(formatInstantForSql(v)).toBe("2024-01-01 00:00:00.000001");
  });

  it("converts a non-UTC instant to UTC", () => {
    const v = Temporal.Instant.from("2026-04-26T16:23:55+02:00");
    expect(formatInstantForSql(v)).toBe("2026-04-26 14:23:55");
  });
});

describe("formatPlainDateTimeForSql", () => {
  it("formats a whole-second datetime", () => {
    const v = Temporal.PlainDateTime.from("2026-04-26T14:23:55");
    expect(formatPlainDateTimeForSql(v)).toBe("2026-04-26 14:23:55");
  });

  it("preserves microsecond precision", () => {
    const v = Temporal.PlainDateTime.from("2024-12-31T23:59:59.999999");
    expect(formatPlainDateTimeForSql(v)).toBe("2024-12-31 23:59:59.999999");
  });

  it("preserves nanosecond precision", () => {
    const v = Temporal.PlainDateTime.from("2024-01-01T00:00:00.000000001");
    expect(formatPlainDateTimeForSql(v)).toBe("2024-01-01 00:00:00.000000001");
  });
});

describe("formatPlainDateForSql", () => {
  it("formats a date", () => {
    expect(formatPlainDateForSql(Temporal.PlainDate.from("2026-04-26"))).toBe("2026-04-26");
  });

  it("zero-pads month and day", () => {
    expect(formatPlainDateForSql(Temporal.PlainDate.from("2026-01-05"))).toBe("2026-01-05");
  });
});

describe("formatPlainTimeForSql", () => {
  it("formats a whole-second time", () => {
    expect(formatPlainTimeForSql(Temporal.PlainTime.from("14:23:55"))).toBe("14:23:55");
  });

  it("preserves microseconds", () => {
    expect(formatPlainTimeForSql(Temporal.PlainTime.from("14:23:55.123456"))).toBe(
      "14:23:55.123456",
    );
  });

  it("preserves nanoseconds", () => {
    expect(formatPlainTimeForSql(Temporal.PlainTime.from("00:00:00.000000001"))).toBe(
      "00:00:00.000000001",
    );
  });

  it("omits trailing zeros beyond the precision present", () => {
    // millisecond only — 3 fractional digits
    expect(formatPlainTimeForSql(Temporal.PlainTime.from("12:00:00.100"))).toBe("12:00:00.100");
  });
});

describe("temporalToBindString", () => {
  it("converts Instant to UTC string", () => {
    const v = Temporal.Instant.from("2026-04-26T14:23:55.123456Z");
    expect(temporalToBindString(v)).toBe("2026-04-26 14:23:55.123456");
  });

  it("converts PlainDateTime to string", () => {
    const v = Temporal.PlainDateTime.from("2026-04-26T14:23:55.000001");
    expect(temporalToBindString(v)).toBe("2026-04-26 14:23:55.000001");
  });

  it("converts PlainDate to string", () => {
    expect(temporalToBindString(Temporal.PlainDate.from("2026-04-26"))).toBe("2026-04-26");
  });

  it("converts PlainTime to string", () => {
    expect(temporalToBindString(Temporal.PlainTime.from("14:23:55.123456"))).toBe(
      "14:23:55.123456",
    );
  });

  it("converts ZonedDateTime to UTC instant string", () => {
    const v = Temporal.ZonedDateTime.from("2026-04-26T16:23:55+02:00[Europe/Paris]");
    expect(temporalToBindString(v)).toBe("2026-04-26 14:23:55");
  });

  it("passes non-Temporal values through unchanged", () => {
    expect(temporalToBindString(42)).toBe(42);
    expect(temporalToBindString("hello")).toBe("hello");
    expect(temporalToBindString(null)).toBe(null);
  });
});
