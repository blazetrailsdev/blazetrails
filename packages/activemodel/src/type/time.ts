import { Temporal } from "@blazetrails/activesupport/temporal";
import { ValueType } from "./value.js";

export class TimeType extends ValueType<Temporal.PlainTime> {
  readonly name = "time";

  cast(value: unknown): Temporal.PlainTime | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Temporal.PlainTime) return value;
    const str = String(value).trim();
    if (str === "") return null;
    const timeStr = extractTimePortion(str);
    if (!timeStr) return null;
    try {
      return Temporal.PlainTime.from(timeStr);
    } catch {
      return null;
    }
  }

  serialize(value: unknown): string | null {
    const cast = this.cast(value);
    return cast ? cast.toString({ smallestUnit: "microsecond" }) : null;
  }

  type(): string {
    return this.name;
  }

  userInputInTimeZone(value: unknown, zone: string = "UTC"): Temporal.ZonedDateTime | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Temporal.ZonedDateTime) return value;
    // Full ZonedDateTime string (has timezone bracket)
    const str = String(value).trim();
    if (str === "") return null;
    if (str.includes("[")) {
      try {
        return Temporal.ZonedDateTime.from(str);
      } catch {
        return null;
      }
    }
    // Otherwise cast to PlainTime and attach the given zone
    const plain = this.cast(value);
    if (!plain) return null;
    return Temporal.Now.plainDateISO(zone).toPlainDateTime(plain).toZonedDateTime(zone);
  }
}

/** Extract the `HH:MM:SS[.ffffff]` portion from a datetime or time-only string. */
function extractTimePortion(str: string): string | null {
  // Time-only: "HH:MM" or "HH:MM:SS..." forms
  if (/^\d{2}:\d{2}/.test(str)) return str;
  // Full datetime: find the time part after T or space separator
  const m = /[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?:[Z+-]|$)/.exec(str);
  return m ? m[1] : null;
}
