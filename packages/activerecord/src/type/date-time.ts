/**
 * Mirrors: ActiveRecord::Type::DateTime
 */
import {
  DateTimeType as ActiveModelDateTime,
  DateInfinity,
  DateNegativeInfinity,
} from "@blazetrails/activemodel";
import { Temporal } from "@blazetrails/activesupport/temporal";
import { isUtc, type TimezoneOptions } from "./internal/timezone.js";
import { formatInstantForSql } from "../connection-adapters/abstract/quoting.js";

export class DateTime extends ActiveModelDateTime {
  private _timezone?: "utc" | "local";

  constructor(options?: TimezoneOptions) {
    super(options);
    this._timezone = options?.timezone;
  }

  get isUtc(): boolean {
    return isUtc(this._timezone);
  }

  override serialize(value: unknown): string | null {
    const cast = this.cast(value);
    if (cast === null || cast === DateInfinity || cast === DateNegativeInfinity) return null;
    // Format as "YYYY-MM-DD HH:MM:SS[.frac]" — accepted by both PG and MySQL/MariaDB.
    // cast() already applies precision truncation via _applySecondsPrecision.
    return formatInstantForSql(cast as Temporal.Instant);
  }
}
