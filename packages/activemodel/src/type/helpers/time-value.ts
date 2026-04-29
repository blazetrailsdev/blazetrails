/**
 * TimeValue helper — shared behavior for time-based type casting.
 *
 * Mirrors: ActiveModel::Type::Helpers::TimeValue
 */
import { Temporal } from "@blazetrails/activesupport/temporal";

export interface TimeValue {
  serializeCastValue(value: unknown): string | null;
  typeCastForSchema(value: unknown): string;
  userInputInTimeZone(value: unknown, zone?: string): Temporal.ZonedDateTime | null;
  applySecondsPrecision<T>(value: T): T;
}

type WithNanos = { nanosecond: number; with: (fields: { nanosecond: number }) => unknown };

/**
 * Mirrors: ActiveModel::Type::Helpers::TimeValue#apply_seconds_precision
 * (time_value.rb:24-34)
 *
 *   def apply_seconds_precision(value)
 *     return value unless precision && value.respond_to?(:nsec)
 *     number_of_insignificant_digits = 9 - precision
 *     round_power = 10**number_of_insignificant_digits
 *     rounded_off_nsec = value.nsec % round_power
 *     if rounded_off_nsec > 0
 *       value.change(nsec: value.nsec - rounded_off_nsec)
 *     else
 *       value
 *     end
 *   end
 *
 * Truncates sub-second precision on Temporal types that carry a
 * `nanosecond` field (PlainDateTime, PlainTime, ZonedDateTime, Instant).
 * Values without nanosecond resolution (PlainDate, primitives) pass
 * through unchanged.
 */
export function applySecondsPrecision<T>(this: { precision?: number }, value: T): T {
  const precision = this.precision;
  if (precision === undefined || precision === null) return value;
  if (value === null || value === undefined) return value;
  const nsHolder = value as unknown as WithNanos;
  if (typeof nsHolder.nanosecond !== "number") return value;
  if (typeof nsHolder.with !== "function") return value;
  const nsec = nsHolder.nanosecond;
  const insignificantDigits = 9 - precision;
  if (insignificantDigits <= 0) return value;
  const roundPower = 10 ** insignificantDigits;
  const remainder = nsec % roundPower;
  if (remainder === 0) return value;
  return nsHolder.with({ nanosecond: nsec - remainder }) as unknown as T;
}

export function serializeTimeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    value instanceof Temporal.Instant ||
    value instanceof Temporal.PlainDateTime ||
    value instanceof Temporal.PlainDate ||
    value instanceof Temporal.PlainTime ||
    value instanceof Temporal.ZonedDateTime
  ) {
    return value.toJSON();
  }
  return String(value);
}

export function userInputInTimeZone(
  value: unknown,
  zone: string = "UTC",
): Temporal.ZonedDateTime | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Temporal.ZonedDateTime) return value;
  const str = String(value).trim();
  if (str === "") return null;
  if (str.includes("[")) {
    try {
      return Temporal.ZonedDateTime.from(str);
    } catch {
      return null;
    }
  }
  try {
    return Temporal.PlainDateTime.from(str.replace(" ", "T")).toZonedDateTime(zone);
  } catch {
    return null;
  }
}
