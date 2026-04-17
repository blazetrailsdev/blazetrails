/**
 * PostgreSQL cidr type — network address (CIDR notation).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Cidr.
 *
 * Rails: `class Cidr < Type::Value`. cast_value parses a String into an
 * IPAddr; serialize renders it back as "addr/prefix". TypeScript has no
 * IPAddr primitive, so we pass the string through and leave parsing to
 * the consumer.
 */

import { Type } from "@blazetrails/activemodel";

export class Cidr extends Type<string> {
  readonly name: string = "cidr";

  override type(): string {
    return "cidr";
  }

  cast(value: unknown): string | null {
    return this.castValue(value);
  }

  override deserialize(value: unknown): string | null {
    return this.castValue(value);
  }

  override serialize(value: unknown): string | null {
    if (value == null) return null;
    return String(value);
  }

  /**
   * Rails Cidr#changed?:
   *   !old.eql?(new) || (!old.nil? && old.prefix != new.prefix)
   *
   * Without an IPAddr type we fall back to string equality, which is a
   * faithful subset — the prefix comparison is implicit in the string.
   */
  override isChanged(
    oldValue: unknown,
    newValue: unknown,
    _newValueBeforeTypeCast?: unknown,
  ): boolean {
    return oldValue !== newValue;
  }

  protected castValue(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "string") return value === "" ? null : value;
    return String(value);
  }
}
