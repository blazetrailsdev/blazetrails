/**
 * Sanity tests confirming the OID classes retrofitted onto
 * ActiveModel::Type::Value inherit the Type hierarchy correctly and
 * preserve Rails-faithful behavior.
 */

import { Type, StringType, BinaryType, DecimalType } from "@blazetrails/activemodel";
import { describe, expect, it } from "vitest";
import { Bit, Data as BitData } from "./bit.js";
import { BitVarying } from "./bit-varying.js";
import { Bytea } from "./bytea.js";
import { Cidr } from "./cidr.js";
import { Inet } from "./inet.js";
import { Macaddr } from "./macaddr.js";
import { Decimal } from "./decimal.js";

describe("OID types extend Type::Value hierarchy", () => {
  it("Bit extends Type", () => {
    expect(new Bit()).toBeInstanceOf(Type);
    expect(new Bit().type()).toBe("bit");
  });

  it("BitVarying extends Bit", () => {
    const bv = new BitVarying();
    expect(bv).toBeInstanceOf(Bit);
    expect(bv).toBeInstanceOf(Type);
    expect(bv.type()).toBe("bit_varying");
  });

  it("Bytea extends Type::Binary", () => {
    expect(new Bytea()).toBeInstanceOf(BinaryType);
    expect(new Bytea()).toBeInstanceOf(Type);
  });

  it("Cidr extends Type", () => {
    expect(new Cidr()).toBeInstanceOf(Type);
    expect(new Cidr().type()).toBe("cidr");
  });

  it("Inet extends Cidr", () => {
    const inet = new Inet();
    expect(inet).toBeInstanceOf(Cidr);
    expect(inet).toBeInstanceOf(Type);
    expect(inet.type()).toBe("inet");
  });

  it("Macaddr extends Type::String", () => {
    const m = new Macaddr();
    expect(m).toBeInstanceOf(StringType);
    expect(m).toBeInstanceOf(Type);
    expect(m.type()).toBe("macaddr");
  });

  it("Decimal extends Type::Decimal", () => {
    expect(new Decimal()).toBeInstanceOf(DecimalType);
    expect(new Decimal()).toBeInstanceOf(Type);
  });
});

describe("OID retrofits — Rails-faithful behavior", () => {
  it("Bit#serialize wraps in Data", () => {
    expect(new Bit().serialize("1010")).toBeInstanceOf(BitData);
    expect(new Bit().serialize(null)).toBeNull();
  });

  it("Bit#cast_value handles hex-prefixed input", () => {
    // Rails: "0xff" → to_s(2) → "11111111"
    expect(new Bit().cast("0xff")).toBe("11111111");
  });

  it("Bit#serialize preserves hex notation (Rails: Data.new(super), not cast)", () => {
    // Rails wraps the raw value in Data; the 0x→binary normalisation is a
    // read-time behavior only. A serialized Data("0xff") round-trips as-is.
    expect(new Bit().serialize("0xff")?.toString()).toBe("0xff");
  });

  it("Bytea#deserialize decodes legacy octal escapes", () => {
    // Rails uses PG::Connection.unescape_bytea which handles octal as well.
    const out = new Bytea().deserialize("a\\134\\000b") as Uint8Array;
    expect(Array.from(out)).toEqual([0x61, 0x5c, 0x00, 0x62]);
  });

  it("Cidr#cast rejects invalid input like Rails IPAddr.new", () => {
    expect(new Cidr().cast("not-an-ip")).toBeNull();
    expect(new Cidr().cast("192.168.1.1")).toBe("192.168.1.1");
    expect(new Cidr().cast("192.168.1.0/24")).toBe("192.168.1.0/24");
    expect(new Cidr().cast("::1")).toBe("::1");
  });

  it("Bytea#deserialize decodes hex escape", () => {
    const out = new Bytea().deserialize("\\x6869") as Uint8Array;
    expect(out).toBeInstanceOf(Uint8Array);
    expect(Array.from(out)).toEqual([0x68, 0x69]);
  });

  it("Macaddr#isChanged is case-insensitive", () => {
    // Rails' Macaddr#changed? calls casecmp, so case differences don't dirty.
    const m = new Macaddr();
    expect(m.isChanged("aa:bb:cc:dd:ee:ff", "AA:BB:CC:DD:EE:FF")).toBe(false);
    expect(m.isChanged("aa:bb:cc:dd:ee:ff", "aa:bb:cc:dd:ee:01")).toBe(true);
  });

  it("Decimal#infinity returns ±Infinity", () => {
    // Rails returns BigDecimal("Infinity"); we return ±Infinity since JS has
    // no BigDecimal. Both read as "unbounded" to Range callsites.
    expect(new Decimal().infinity()).toBe(Infinity);
    expect(new Decimal().infinity({ negative: true })).toBe(-Infinity);
  });
});
