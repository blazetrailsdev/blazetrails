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
   * ArgumentError. Without an IPAddr primitive in TS, validate syntax
   * ourselves and return null for anything that isn't a plausible
   * CIDR-shaped string (Rails' behavior for non-String input is a
   * pass-through, but our TS return type is `string | null`, so we
   * return null rather than lie about the type).
   */
  protected castValue(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== "string") return null;
    if (value === "") return null;
    return isCidrShaped(value) ? value : null;
  }
}

const IPV4_OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const IPV6_HEXTET = /^[0-9a-fA-F]{1,4}$/;
const IPV6_CHARS = /^[0-9a-fA-F:]+$/;

function isCidrShaped(value: string): boolean {
  const slash = value.indexOf("/");
  const address = slash === -1 ? value : value.slice(0, slash);
  const prefix = slash === -1 ? null : value.slice(slash + 1);

  if (!address) return false;

  if (isIpv4(address)) {
    return prefix == null ? true : isValidPrefix(prefix, 32);
  }
  if (isIpv6(address)) {
    return prefix == null ? true : isValidPrefix(prefix, 128);
  }
  return false;
}

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((p) => IPV4_OCTET.test(p));
}

function isIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  if (!IPV6_CHARS.test(value)) return false;
  const doubleColons = value.match(/::/g);
  if (doubleColons && doubleColons.length > 1) return false;
  if (value === "::") return true;

  if (value.includes("::")) {
    const [left, right] = value.split("::");
    const leftParts = left === "" ? [] : left.split(":");
    const rightParts = right === "" ? [] : right.split(":");
    if (
      leftParts.some((p) => !IPV6_HEXTET.test(p)) ||
      rightParts.some((p) => !IPV6_HEXTET.test(p))
    ) {
      return false;
    }
    return leftParts.length + rightParts.length < 8;
  }

  const parts = value.split(":");
  return parts.length === 8 && parts.every((p) => IPV6_HEXTET.test(p));
}

function isValidPrefix(prefix: string, max: number): boolean {
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const n = Number(prefix);
  return n >= 0 && n <= max;
}
