/**
 * Mirrors: ActiveRecord::Type::Time
 *
 * TimeValue will be re-implemented on Temporal.ZonedDateTime in PR 8.
 * For now it is a thin shell that keeps the type hierarchy intact while
 * the activemodel cast layer has been flipped to Temporal.PlainTime.
 */
import { Temporal } from "@blazetrails/activesupport/temporal";
import { TimeType as ActiveModelTime } from "@blazetrails/activemodel";
import { isUtc, type TimezoneOptions } from "./internal/timezone.js";

export class Time extends ActiveModelTime {
  private _timezone?: "utc" | "local";

  constructor(options?: TimezoneOptions) {
    super();
    this._timezone = options?.timezone;
  }

  get isUtc(): boolean {
    return isUtc(this._timezone);
  }

  override serialize(value: unknown): string | null {
    return super.serialize(value);
  }

  override serializeCastValue(value: Temporal.PlainTime | null): string | null {
    if (value == null) return null;
    return value.toString({ smallestUnit: "microsecond" });
  }
}
