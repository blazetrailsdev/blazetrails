import { describe, expect, it } from "vitest";
import { Array as OidArray } from "./array.js";
import { Enum } from "./enum.js";
import { Range } from "./range.js";
import { TypeMapInitializer, type TypeMap } from "./type-map-initializer.js";
import { Vector } from "./vector.js";

class TestStore implements TypeMap {
  readonly mapping = new Map<number | string, unknown>();

  registerType(oid: number | string, type: unknown): void {
    this.mapping.set(oid, type);
  }

  aliasType(oid: number | string, targetOid: number | string): void {
    this.mapping.set(oid, this.mapping.get(targetOid));
  }

  lookup(oid: number | string): unknown {
    return this.mapping.get(oid);
  }

  has(oid: number | string): boolean {
    return this.mapping.has(oid);
  }

  keys(): Array<number | string> {
    return [...this.mapping.keys()];
  }
}

const integerSubtype = {
  cast: (value: unknown) => (value == null ? null : Number(value)),
  serialize: (value: unknown) => (value == null ? null : Number(value)),
};

describe("PostgreSQL::OID::TypeMapInitializer", () => {
  it("registers arrays, ranges, enums, domains, mapped types, and composites", () => {
    const store = new TestStore();
    store.registerType("int4", integerSubtype);
    store.registerType(23, integerSubtype);

    new TypeMapInitializer(store).run([
      row({ oid: 1007, typname: "_int4", typinput: "array_in", typelem: 23 }),
      row({ oid: 3904, typname: "int4range", typtype: "r", rngsubtype: 23 }),
      row({ oid: 5000, typname: "mood", typtype: "e" }),
      row({ oid: 6000, typname: "positive_int", typtype: "d", typbasetype: 23 }),
      row({ oid: 7000, typname: "int_pair", typelem: 23 }),
      row({ oid: 8000, typname: "int4" }),
    ]);

    expect(store.lookup(1007)).toBeInstanceOf(OidArray);
    expect(store.lookup(3904)).toBeInstanceOf(Range);
    expect(store.lookup(5000)).toBeInstanceOf(Enum);
    expect(store.lookup(6000)).toBe(integerSubtype);
    const vector = store.lookup(7000) as Vector;
    expect(vector).toBeInstanceOf(Vector);
    expect(vector.delim).toBe(",");
    expect(vector.subtype).toBe(integerSubtype);
    expect(store.lookup(8000)).toBe(integerSubtype);
  });

  it("builds query condition fragments", () => {
    const store = new TestStore();
    store.registerType("int4", integerSubtype);
    store.registerType(23, integerSubtype);
    const initializer = new TypeMapInitializer(store);

    expect(initializer.queryConditionsForKnownTypeNames()).toContain("'int4'");
    expect(initializer.queryConditionsForKnownTypeTypes()).toContain("'r'");
    expect(initializer.queryConditionsForArrayTypes()).toContain("23");
  });
});

function row(overrides: Partial<Parameters<TypeMapInitializer["run"]>[0][number]>) {
  return {
    oid: 1,
    typname: "type",
    typelem: 0,
    typdelim: ",",
    typtype: "b",
    typbasetype: 0,
    typarray: 0,
    ...overrides,
  };
}
