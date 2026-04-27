/**
 * Temporal test helpers. Test files use these instead of `new Date(...)`.
 */
import { Temporal } from "../temporal.js";

export function instant(iso: string): Temporal.Instant {
  return Temporal.Instant.from(iso);
}

export function plainDateTime(iso: string): Temporal.PlainDateTime {
  return Temporal.PlainDateTime.from(iso);
}

export function plainDate(iso: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(iso);
}

export function plainTime(iso: string): Temporal.PlainTime {
  return Temporal.PlainTime.from(iso);
}

export function zonedDateTime(iso: string): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(iso);
}

/**
 * Convert a Temporal datetime value to epoch milliseconds.
 * Works with both Temporal.Instant and Temporal.PlainDateTime (treating
 * PlainDateTime as UTC, matching ActiveRecord's default_timezone=:utc).
 */
export function epochMs(v: unknown): number {
  if (v instanceof Temporal.Instant) return v.epochMilliseconds;
  if (v instanceof Temporal.PlainDateTime)
    return v.toZonedDateTime("UTC").toInstant().epochMilliseconds;
  throw new TypeError(`epochMs: unsupported type ${(v as object)?.constructor?.name}`);
}

/**
 * Returns true if the value is a Temporal datetime type (Instant or PlainDateTime).
 * datetime columns return Temporal.PlainDateTime on Postgres (timestamp without tz)
 * and Temporal.Instant on SQLite (UTC convention).
 */
export function isTemporalDatetime(v: unknown): boolean {
  return v instanceof Temporal.Instant || v instanceof Temporal.PlainDateTime;
}
