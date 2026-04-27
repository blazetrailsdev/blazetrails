import { Temporal } from "@blazetrails/activesupport/temporal";
import { ValueType } from "./value.js";

export type DateTimeCastResult = Temporal.Instant | Temporal.PlainDateTime;

export class DateTimeType extends ValueType<DateTimeCastResult> {
  readonly name: string = "datetime";

  cast(value: unknown): DateTimeCastResult | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Temporal.Instant) return value;
    if (value instanceof Temporal.PlainDateTime) return value;
    const str = String(value).trim();
    if (str === "") return null;
    return this.parseString(str);
  }

  private parseString(str: string): DateTimeCastResult | null {
    // Normalize wire-format quirks before parsing:
    //   space separator → T; short offset ±HH → ±HH:MM
    const normalized = str
      .replace(" ", "T")
      .replace(/(T\d{2}:\d{2}:\d{2}(?:\.\d+)?)([-+]\d{2})$/, "$1$2:00");
    const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
    if (hasOffset) {
      try {
        return Temporal.Instant.from(normalized);
      } catch {
        return null;
      }
    }
    try {
      return Temporal.PlainDateTime.from(normalized);
    } catch {
      return null;
    }
  }

  serialize(value: unknown): string | null {
    const cast = this.cast(value);
    if (cast === null) return null;
    return cast.toString({ smallestUnit: "microsecond" });
  }

  type(): string {
    return this.name;
  }
}
