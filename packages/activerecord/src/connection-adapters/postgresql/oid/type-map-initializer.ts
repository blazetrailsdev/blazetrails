/**
 * PostgreSQL type map initializer — populates a type map from pg_type rows.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::TypeMapInitializer
 */

import { Array as OidArray } from "./array.js";
import { Enum } from "./enum.js";
import { Range } from "./range.js";
import { Vector } from "./vector.js";

export interface TypeMap {
  registerType(
    oid: number | string,
    type: unknown | ((oid: number | string, ...args: unknown[]) => unknown),
  ): void;
  aliasType(oid: number | string, targetOid: number | string): void;
  lookup?(oid: number | string, ...args: unknown[]): unknown;
  has?(oid: number | string): boolean;
  keys?(): Array<number | string>;
}

export interface PgTypeRow {
  oid: number;
  typname: string;
  typelem: number;
  typdelim: string;
  typtype: string;
  typbasetype: number;
  typarray: number;
  typinput?: string;
  rngsubtype?: number;
}

export class TypeMapInitializer {
  private store: TypeMap;

  constructor(store: TypeMap) {
    this.store = store;
  }

  run(records: PgTypeRow[]): void {
    const nodes = records.filter((row) => !this.storeHas(row.oid));
    const mapped = extract(nodes, (row) => this.storeHas(row.typname));
    const ranges = extract(nodes, (row) => row.typtype === "r");
    const enums = extract(nodes, (row) => row.typtype === "e");
    const domains = extract(nodes, (row) => row.typtype === "d");
    const arrays = extract(nodes, (row) => row.typinput === "array_in");
    const composites = extract(nodes, (row) => row.typelem > 0);

    mapped.forEach((row) => this.registerMappedType(row));
    enums.forEach((row) => this.registerEnumType(row));
    domains.forEach((row) => this.registerDomainType(row));
    arrays.forEach((row) => this.registerArrayType(row));
    ranges.forEach((row) => this.registerRangeType(row));
    composites.forEach((row) => this.registerCompositeType(row));
  }

  runInitializer(records: PgTypeRow[]): void {
    this.run(records);
  }

  queryConditionsForKnownTypeNames(): string {
    return `WHERE\n  t.typname IN (${this.quotedKnownTypeNames().join(", ")})\n`;
  }

  queryConditionsForKnownTypeTypes(): string {
    return "WHERE\n  t.typtype IN ('r', 'e', 'd')\n";
  }

  queryConditionsForArrayTypes(): string {
    const knownTypeOids = this.storeKeys().filter((key) => typeof key === "number");
    return `WHERE\n  t.typelem IN (${knownTypeOids.join(", ")})\n`;
  }

  private registerBaseType(row: PgTypeRow): void {
    this.store.registerType(row.oid, { name: row.typname });
  }

  private registerMappedType(row: PgTypeRow): void {
    this.store.aliasType(row.oid, row.typname);
  }

  private registerRangeType(row: PgTypeRow): void {
    this.registerWithSubtype(
      row.oid,
      row.rngsubtype ?? 0,
      (subtype) => new Range(subtype, row.typname),
    );
  }

  private registerEnumType(row: PgTypeRow): void {
    this.store.registerType(row.oid, new Enum());
  }

  private registerDomainType(row: PgTypeRow): void {
    if (row.typbasetype > 0 && this.storeLookup(row.typbasetype)) {
      this.store.aliasType(row.oid, row.typbasetype);
    }
  }

  private registerCompositeType(row: PgTypeRow): void {
    const subtype = this.storeLookup(row.typelem);
    if (subtype) this.store.registerType(row.oid, new Vector(row.typdelim, subtype));
  }

  private registerArrayType(row: PgTypeRow): void {
    this.registerWithSubtype(
      row.oid,
      row.typelem,
      (subtype) => new OidArray(subtype, row.typdelim),
    );
    if (row.typarray > 0) {
      this.registerWithSubtype(
        row.typarray,
        row.oid,
        (subtype) => new OidArray(subtype, row.typdelim),
      );
    }
  }

  private registerWithSubtype(
    oid: number,
    targetOid: number,
    build: (subtype: {
      cast(value: unknown): unknown;
      serialize(value: unknown): unknown;
    }) => unknown,
  ): void {
    const subtype = this.storeLookup(targetOid);
    if (isSubtype(subtype)) this.store.registerType(oid, build(subtype));
  }

  private storeHas(key: number | string): boolean {
    if (this.store.has) return this.store.has(key);
    return this.storeKeys().includes(key);
  }

  private storeKeys(): Array<number | string> {
    return this.store.keys?.() ?? [];
  }

  private storeLookup(key: number | string): unknown {
    return this.store.lookup?.(key);
  }

  private quotedKnownTypeNames(): string[] {
    return this.storeKeys()
      .filter((key): key is string => typeof key === "string")
      .map((key) => `'${key.replace(/'/g, "''")}'`);
  }
}

function extract<T>(values: T[], predicate: (value: T) => boolean): T[] {
  const extracted: T[] = [];
  for (let i = values.length - 1; i >= 0; i--) {
    if (predicate(values[i])) {
      extracted.unshift(values[i]);
      values.splice(i, 1);
    }
  }
  return extracted;
}

function isSubtype(
  value: unknown,
): value is { cast(value: unknown): unknown; serialize(value: unknown): unknown } {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { cast?: unknown }).cast === "function" &&
    typeof (value as { serialize?: unknown }).serialize === "function"
  );
}
