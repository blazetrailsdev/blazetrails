/**
 * PostgreSQL cidr type — network address (CIDR notation).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Cidr.
 *
 * Rails: `class Cidr < Type::Value`. cast_value parses a String into an
 * IPAddr; serialize renders it back as "addr/prefix". TypeScript has no
 * stdlib IPAddr, so we provide IpAddr as a lightweight equivalent.
 */

import { ValueType } from "@blazetrails/activemodel";

/**
 * Lightweight equivalent of Ruby's IPAddr, carrying address + prefix length.
 * Mirrors the Rails IPAddr shape used by Cidr#serialize and Cidr#changed?.
 */
export class IpAddr {
  constructor(
    readonly address: string,
    readonly prefixLength: number,
  ) {}

  /** Returns just the address portion, like Ruby IPAddr#to_s. */
  toString(): string {
    return this.address;
  }
}

export class Cidr extends ValueType<IpAddr> {
  readonly name: string = "cidr";

  override type(): string {
    return "cidr";
  }

  cast(value: unknown): IpAddr | null {
    return this.castValue(value);
  }

  override deserialize(value: unknown): IpAddr | null {
    return this.castValue(value);
  }

  /**
   * Rails Cidr#serialize:
   *   if IPAddr === value then "#{value}/#{value.prefix}" else value
   * Accepts IpAddr instances and emits canonical "addr/prefix" form;
   * passes non-IpAddr values (e.g. raw strings) through unchanged.
   */
  override serialize(value: unknown): string | null {
    if (value instanceof IpAddr) return `${value.address}/${value.prefixLength}`;
    if (value == null) return null;
    return String(value);
  }

  /**
   * Rails Cidr#changed?:
   *   !old_value.eql?(new_value) || !old_value.nil? && old_value.prefix != new_value.prefix
   *
   * Ruby's IPAddr#eql? compares only the address bits (not the prefix), hence
   * the explicit prefix guard. We normalise both sides to { address, prefix }
   * so the comparison is always prefix-aware regardless of whether the caller
   * supplies strings or IpAddr instances.
   */
  override isChanged(
    oldValue: unknown,
    newValue: unknown,
    _newValueBeforeTypeCast?: unknown,
  ): boolean {
    const oldC = toComparable(oldValue);
    const newC = toComparable(newValue);
    if (oldC === null && newC === null) return false;
    if (oldC === null || newC === null) return true;
    return oldC.address !== newC.address || oldC.prefix !== newC.prefix;
  }

  /**
   * Rails Cidr#cast_value:
   *   nil → nil
   *   String → IPAddr.new(value) or nil on ArgumentError
   *   else → value (pass-through for existing IPAddr instances)
   */
  castValue(value: unknown): IpAddr | null {
    if (value == null) return null;
    if (value instanceof IpAddr) return value;
    if (typeof value !== "string") return null;
    return parseIpAddr(value);
  }

  /**
   * Rails Cidr#type_cast_for_schema:
   *   if value.prefix == 32 then "\"#{value}\"" else "\"#{value}/#{value.prefix}\""
   *
   * Rails checks only prefix == 32 (IPv4 host) and omits the suffix.
   * "#{value}" calls IPAddr#to_s which returns just the address string.
   */
  override typeCastForSchema(value: unknown): string {
    if (value instanceof IpAddr) {
      if (value.prefixLength === 32) return JSON.stringify(value.address);
      return JSON.stringify(`${value.address}/${value.prefixLength}`);
    }
    return super.typeCastForSchema(value);
  }
}

function toComparable(value: unknown): { address: string; prefix: number } | null {
  if (value === null || value === undefined) return null;
  if (value instanceof IpAddr) return { address: value.address, prefix: value.prefixLength };
  if (typeof value === "string") {
    const slash = value.indexOf("/");
    if (slash === -1) return { address: value, prefix: isIpv6(value) ? 128 : 32 };
    return { address: value.slice(0, slash), prefix: Number(value.slice(slash + 1)) };
  }
  return null;
}

/**
 * Parses a CIDR/inet string into an IpAddr. Mirrors IPAddr.new(str): returns
 * null for invalid input (Rails raises ArgumentError, which cast_value rescues).
 * Defaults to /32 for IPv4 and /128 for IPv6 when no prefix is specified.
 */
function parseIpAddr(value: string): IpAddr | null {
  if (value === "") return null;
  const slash = value.indexOf("/");
  const address = slash === -1 ? value : value.slice(0, slash);
  const prefixStr = slash === -1 ? null : value.slice(slash + 1);

  if (isIpv4(address)) {
    if (prefixStr == null) return new IpAddr(address, 32);
    if (!isValidPrefix(prefixStr, 32)) return null;
    return new IpAddr(address, Number(prefixStr));
  }
  if (isIpv6(address)) {
    if (prefixStr == null) return new IpAddr(address, 128);
    if (!isValidPrefix(prefixStr, 128)) return null;
    return new IpAddr(address, Number(prefixStr));
  }
  return null;
}

/**
 * Lightweight IP syntax validators. Rails uses IPAddr.new (which rescues
 * ArgumentError); we inline parsers here rather than pulling in
 * `node:net.isIP` (blocked by a repo-wide no-Node-builtins lint rule
 * for browser compat). Accepts IPv4, IPv6, and IPv4-embedded IPv6
 * (e.g. ::ffff:192.168.0.1) — enough to match PG's input syntax.
 */
const IPV4_OCTET = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

function isIpv4(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((p) => IPV4_OCTET.test(p));
}

const IPV6_HEXTET = /^[0-9a-fA-F]{1,4}$/;

function isIpv6(value: string): boolean {
  if (!value.includes(":")) return false;
  const doubleColons = value.match(/::/g);
  if (doubleColons && doubleColons.length > 1) return false;
  if (value === "::") return true;

  // Split the trailing IPv4 tail (e.g. ::ffff:192.168.0.1) out of the
  // hextet sequence. It counts as 2 hextets toward the 8-group total.
  const parts = value.split(":");
  const last = parts[parts.length - 1];
  let ipv4Tail = false;
  if (last.includes(".")) {
    if (!isIpv4(last)) return false;
    ipv4Tail = true;
    parts[parts.length - 1] = "0";
    parts.push("0");
  }

  if (value.includes("::")) {
    const [left, right] = value.split("::");
    const leftParts = left === "" ? [] : left.split(":");
    let rightParts = right === "" ? [] : right.split(":");
    if (ipv4Tail) {
      // IPv4 tail already counted as two placeholder hextets above.
      rightParts = rightParts.slice(0, -1).concat(["0", "0"]);
    }
    if (
      leftParts.some((p) => !IPV6_HEXTET.test(p)) ||
      rightParts.some((p) => !IPV6_HEXTET.test(p))
    ) {
      return false;
    }
    return leftParts.length + rightParts.length < 8;
  }

  return parts.length === 8 && parts.every((p) => IPV6_HEXTET.test(p));
}

function isValidPrefix(prefix: string, max: number): boolean {
  if (!/^\d{1,3}$/.test(prefix)) return false;
  const n = Number(prefix);
  return n >= 0 && n <= max;
}
