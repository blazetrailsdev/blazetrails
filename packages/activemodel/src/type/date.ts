import { Temporal } from "@blazetrails/activesupport/temporal";
import { ValueType } from "./value.js";

export class DateType extends ValueType<Temporal.PlainDate> {
  readonly name: string = "date";

  cast(value: unknown): Temporal.PlainDate | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Temporal.PlainDate) return value;
    const str = String(value).trim();
    if (str === "") return null;
    try {
      return Temporal.PlainDate.from(str);
    } catch {
      return null;
    }
  }

  serialize(value: unknown): string | null {
    const cast = this.cast(value);
    return cast ? cast.toString() : null;
  }

  type(): string {
    return this.name;
  }

  typeCastForSchema(value: unknown): string {
    const cast = this.cast(value);
    return cast ? JSON.stringify(cast.toString()) : "null";
  }
}
