/**
 * Time zone conversion for ActiveRecord attributes.
 *
 * Automatically converts time attributes to the application's time zone
 * when reading, and to UTC when writing.
 *
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion
 */

/**
 * The TimeZoneConversion module interface.
 *
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion
 */
export interface TimeZoneConversion {
  timeZoneAwareAttributes: string[];
  skipTimeZoneConversionForAttributes: string[];
}

/**
 * Time zone converter type — wraps a time type to apply zone conversion.
 *
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion::TimeZoneConverter
 */
export class TimeZoneConverter {
  private readonly subtype: { cast(value: unknown): unknown };

  constructor(subtype: { cast(value: unknown): unknown }) {
    this.subtype = subtype;
  }

  cast(value: unknown): unknown {
    const result = this.subtype.cast(value);
    if (result instanceof Date) {
      return result;
    }
    return result;
  }
}
