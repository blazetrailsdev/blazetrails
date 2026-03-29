/**
 * ActiveRecord fixture loading and management.
 *
 * Mirrors: ActiveRecord::FixtureSet
 *
 * Fixtures provide a way to define test data in a declarative format
 * (typically YAML/JSON) and load it into the database for tests.
 */

import type { DatabaseAdapter } from "../adapter.js";
import { quoteIdentifier, quoteTableName } from "../connection-adapters/abstract/quoting.js";
import { detectAdapterName } from "../adapter-name.js";
import { type ReflectionProxy } from "./table-row.js";
import { TableRows } from "./table-rows.js";

const MAX_ID = 2 ** 30 - 1;

/**
 * Generate a deterministic integer ID from a fixture label.
 * Uses the same algorithm as Rails: Zlib.crc32(label.to_s) % MAX_ID
 *
 * Mirrors: ActiveRecord::FixtureSet.identify
 */
export function identify(label: string): number {
  const crc = crc32(Buffer.from(label));
  return ((crc % MAX_ID) + MAX_ID) % MAX_ID;
}

/**
 * Generate a composite identity from a label for composite primary keys.
 * Returns an object mapping each key column name to a deterministic ID.
 *
 * Mirrors: ActiveRecord::FixtureSet.composite_identify
 */
export function compositeIdentify(label: string, keyColumns: string[]): Record<string, number> {
  const baseId = identify(label);
  const result: Record<string, number> = {};
  for (let i = 0; i < keyColumns.length; i++) {
    result[keyColumns[i]] = Number((BigInt(baseId) * (1n << BigInt(i))) % BigInt(MAX_ID));
  }
  return result;
}

/**
 * CRC-32 implementation matching Ruby's Zlib.crc32.
 */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

/**
 * Mirrors: ActiveRecord::FixtureSet::File
 *
 * Reads and parses fixture data from a file (YAML in Rails, JSON/objects in TS).
 */
export class File {
  private _data: Record<string, Record<string, unknown>>;

  constructor(data: Record<string, Record<string, unknown>>) {
    this._data = data;
  }

  get rows(): Array<[string, Record<string, unknown>]> {
    return Object.entries(this._data);
  }

  get labels(): string[] {
    return Object.keys(this._data);
  }

  static parse(data: Record<string, Record<string, unknown>>): File {
    return new File(data);
  }
}

/**
 * A set of fixtures loaded from data (typically parsed from YAML).
 *
 * Mirrors: ActiveRecord::FixtureSet
 */
export class FixtureSet {
  readonly tableName: string;
  private _fixtures: Map<string, Record<string, unknown>>;

  constructor(tableName: string, data: Record<string, Record<string, unknown>>) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error(`Invalid fixture data for "${tableName}": expected an object`);
    }
    this.tableName = tableName;
    this._fixtures = new Map();
    for (const [label, attrs] of Object.entries(data)) {
      if (label === "DEFAULTS") continue;
      const defaults = data["DEFAULTS"] ?? {};
      this._fixtures.set(label, { ...defaults, ...attrs });
    }
  }

  get size(): number {
    return this._fixtures.size;
  }

  get(label: string): Record<string, unknown> | undefined {
    return this._fixtures.get(label);
  }

  forEach(callback: (label: string, fixture: Record<string, unknown>) => void): void {
    for (const [label, fixture] of this._fixtures) {
      callback(label, fixture);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, Record<string, unknown>]> {
    return this._fixtures.entries();
  }

  labels(): string[] {
    return Array.from(this._fixtures.keys());
  }

  /**
   * Generate fixture rows with deterministic IDs.
   * If a fixture doesn't have a primary key value, one is generated
   * from the label using identify().
   */
  toRows(
    options: {
      primaryKey?: string;
      associations?: ReflectionProxy[];
    } = {},
  ): Array<Record<string, unknown>> {
    const data: Record<string, Record<string, unknown>> = {};
    for (const [label, attrs] of this._fixtures) {
      data[label] = attrs;
    }
    const tableRows = new TableRows(this.tableName, data, options);
    return tableRows.toRecords();
  }

  /**
   * Insert all fixture rows into the database.
   * Resolves association labels to foreign key IDs if associations are provided.
   *
   * Mirrors: ActiveRecord::FixtureSet#insert
   */
  async insertAll(
    adapter: DatabaseAdapter,
    options: { primaryKey?: string; associations?: ReflectionProxy[] } = {},
  ): Promise<void> {
    const rows = this.toRows(options);
    if (rows.length === 0) return;

    const adapterName = detectAdapterName(adapter);
    const columnsSet = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) columnsSet.add(key);
    }
    const columns = Array.from(columnsSet);
    const quotedTable = quoteTableName(this.tableName, adapterName);
    const quotedCols = columns.map((c) => quoteIdentifier(c, adapterName)).join(", ");

    await adapter.beginTransaction();
    try {
      for (const row of rows) {
        const values = columns.map((c) => (c in row ? row[c] : null));
        const placeholders = columns
          .map((_, i) => (adapterName === "postgres" ? `$${i + 1}` : "?"))
          .join(", ");
        await adapter.executeMutation(
          `INSERT INTO ${quotedTable} (${quotedCols}) VALUES (${placeholders})`,
          values,
        );
      }
      await adapter.commit();
    } catch (error) {
      await adapter.rollback();
      throw error;
    }
  }

  /**
   * Delete all rows from the fixture's table, then insert fixtures.
   *
   * Mirrors: ActiveRecord::FixtureSet#create_fixtures (truncate + insert)
   */
  async loadInto(
    adapter: DatabaseAdapter,
    options: { primaryKey?: string; associations?: ReflectionProxy[] } = {},
  ): Promise<void> {
    const adapterName = detectAdapterName(adapter);
    const quotedTable = quoteTableName(this.tableName, adapterName);
    await adapter.executeMutation(`DELETE FROM ${quotedTable}`);
    await this.insertAll(adapter, options);
  }
}
