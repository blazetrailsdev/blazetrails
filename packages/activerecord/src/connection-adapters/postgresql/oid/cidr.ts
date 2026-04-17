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

  /**
   * Rails' cast_value uses `IPAddr.new(value)` and returns nil on
   * ArgumentError. Without an IPAddr primitive in TS we do lightweight
   * syntactic validation (IPv4 / IPv6 / optional /prefix) and reject
   * anything that isn't a plausible CIDR-shaped string.
   */
  protected castValue(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== "string") return String(value);
    if (value === "") return null;
    return isCidrShaped(value) ? value : null;
  }
}

const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = `${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}`;
const IPV6 = "[0-9a-fA-F:]+"; // loose; Rails trusts IPAddr here too
const CIDR_SHAPE = new RegExp(`^(?:${IPV4}|${IPV6})(?:/\\d{1,3})?$`);

function isCidrShaped(value: string): boolean {
  return CIDR_SHAPE.test(value);
}
