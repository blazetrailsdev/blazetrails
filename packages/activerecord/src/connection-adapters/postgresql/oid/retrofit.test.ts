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
