/**
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion
 */
export interface TimeZoneConversion {
  timeZoneAwareAttributes: boolean;
  skipTimeZoneConversionForAttributes: string[];
}

type Subtype = {
  cast(value: unknown): unknown;
  deserialize?(value: unknown): unknown;
  map?(value: unknown): unknown;
};

/**
 * Time zone converter type — wraps a time type to apply zone conversion.
 *
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion::TimeZoneConverter
 */
export class TimeZoneConverter {
  private readonly subtype: Subtype;

  constructor(subtype: Subtype) {
    this.subtype = subtype;
  }

  /** Idempotent factory — mirrors Rails' `self.new` guard. */
  static wrap(subtype: Subtype): TimeZoneConverter {
    return subtype instanceof TimeZoneConverter ? subtype : new TimeZoneConverter(subtype);
  }

  cast(value: unknown): unknown {
    if (value == null) return null;
    if (Array.isArray(value)) {
      // mirrors: map(super) { |v| cast(v) }
      const casted = this.subtype.cast(value);
      return Array.isArray(casted) ? casted.map((v) => this.cast(v)) : this.cast(casted);
    }
    // TODO: requires TimeWithZone — user_input_in_time_zone(value) for time-like values
    return this.subtype.cast(value);
  }

  deserialize(value: unknown): unknown {
    const raw = this.subtype.deserialize
      ? this.subtype.deserialize(value)
      : this.subtype.cast(value);
    return convertTimeToTimeZone(raw);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof TimeZoneConverter && this.subtype === (other as TimeZoneConverter).subtype
    );
  }
}

/** @internal */
function convertTimeToTimeZone(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => convertTimeToTimeZone(v));
  }
  // TODO: requires TimeWithZone — value.in_time_zone for time-like values
  return value;
}

/** @internal */
function setTimeZoneWithoutConversion(value: unknown): unknown {
  if (value == null) return value;
  // TODO: requires TimeWithZone — Time.zone.local_to_utc(value).try(:in_time_zone)
  return value;
}

// Silence unused-variable warnings until TimeWithZone is implemented.
void setTimeZoneWithoutConversion;

interface TimeZoneConversionHost {
  timeZoneAwareAttributes: boolean;
  skipTimeZoneConversionForAttributes: string[];
  timeZoneAwareTypes: string[];
  _hookAttributeType?(name: string, castType: unknown): unknown;
}

/**
 * @internal
 * Mirrors: ActiveRecord::AttributeMethods::TimeZoneConversion::ClassMethods#hook_attribute_type
 */
export function hookAttributeType(
  this: TimeZoneConversionHost,
  name: string,
  castType: { type?(): string },
): unknown {
  if (isCreateTimeZoneConversionAttribute.call(this, name, castType)) {
    return TimeZoneConverter.wrap(castType as Subtype);
  }
  return castType;
}

/** @internal */
function isCreateTimeZoneConversionAttribute(
  this: TimeZoneConversionHost,
  name: string,
  castType: { type?(): string },
): boolean {
  const enabledForColumn =
    this.timeZoneAwareAttributes && !this.skipTimeZoneConversionForAttributes.includes(name as any);
  return (
    enabledForColumn &&
    (this.timeZoneAwareTypes ?? ["datetime", "time"]).includes(castType.type?.() ?? "")
  );
}
