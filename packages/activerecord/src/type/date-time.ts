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
    let instant = cast as Temporal.Instant;
    // Truncate to effective precision before formatting. _applySecondsPrecision is a
    // no-op when precision is null; apply a 6-digit (microsecond) default to match
    // ActiveModel's serialize behavior and stay within MySQL DATETIME(6) max.
    const p = this.precision;
    const digits = Number.isInteger(p) && p! >= 0 && p! <= 9 ? p! : 6;
    const mod = 10n ** BigInt(9 - digits);
    let subsec = instant.epochNanoseconds % 1_000_000_000n;
    if (subsec < 0n) subsec += 1_000_000_000n;
    const remainder = subsec % mod;
    if (remainder !== 0n) {
      instant = Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds - remainder);
    }
    // Format as "YYYY-MM-DD HH:MM:SS[.frac]" — accepted by both PG and MySQL/MariaDB.
    return formatInstantForSql(instant);
  }
}
