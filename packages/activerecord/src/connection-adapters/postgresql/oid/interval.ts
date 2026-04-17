/**
 * PostgreSQL interval type — represents a time duration.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Interval.
 * Rails: `class Interval < Type::Value`. cast_value accepts Duration
 * or ISO8601 string; serialize emits ISO8601; type_cast_for_schema
 * inspects the serialized form.
 */

import { Type } from "@blazetrails/activemodel";
import { Duration } from "@blazetrails/activesupport";

export class Interval extends Type<Duration> {
  readonly name: string = "interval";

  constructor(options?: { precision?: number }) {
    super(options);
  }

  override type(): string {
    return "interval";
  }

  cast(value: unknown): Duration | null {
    if (value == null) return null;
    if (value instanceof Duration) return value;
    if (typeof value === "string") {
      try {
        return Duration.parse(value);
      } catch {
        return null;
      }
    }
    return null;
  }

  override serialize(value: unknown): string | null {
    if (value == null) return null;
    if (value instanceof Duration) {
      return value.iso8601({ precision: this.precision ?? null });
    }
    if (typeof value === "number") {
      // Rails: `Time - Time` yields a Float seconds count; build a Duration
      // and ISO8601-serialize it so numeric inputs round-trip consistently.
      return Duration.build(value).iso8601({ precision: this.precision ?? null });
    }
    return super.serialize(value) as string | null;
  }

  override typeCastForSchema(value: unknown): string {
    const serialized = this.serialize(value);
    if (serialized == null) return "nil";
    // Rails: `serialize(value).inspect` — quote the string for schema dump.
    return `"${serialized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
}
