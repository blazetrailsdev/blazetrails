import { describe, expect, it } from "vitest";

import { Cidr } from "./cidr.js";

describe("PostgreSQL::OID::Cidr", () => {
  it("type_cast_for_schema quotes the address with embedded prefix", () => {
    // Rails branches on `value.prefix == 32`: omit the prefix for /32.
    // Our string-based cidr carries the prefix inline; quote as-is.
    const type = new Cidr();
    expect(type.typeCastForSchema("192.168.1.0/24")).toBe('"192.168.1.0/24"');
    expect(type.typeCastForSchema("192.168.1.1")).toBe('"192.168.1.1"');
    expect(type.typeCastForSchema("::1")).toBe('"::1"');
  });

  it("castValue is the public Rails-named hook", () => {
    const type = new Cidr();
    expect(type.castValue("192.168.1.1")).toBe("192.168.1.1");
    expect(type.castValue("not-an-ip")).toBeNull();
  });
});
