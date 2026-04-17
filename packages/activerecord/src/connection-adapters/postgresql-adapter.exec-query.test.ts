/**
 * PostgreSQLAdapter#execQuery + #lookupCastTypeFromColumn.
 *
 * Uses a mocked pg.Client-like connection so the tests don't require a
 * live PostgreSQL; they verify that each field's dataTypeID resolves
 * through the adapter's type_map, that the resulting Result has
 * columnTypes populated, and that iterating those types actually casts
 * cell values through the right OID::Type.
 */
import { ValueType } from "@blazetrails/activemodel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Result } from "../result.js";
import { Uuid } from "./postgresql/oid/uuid.js";
import { PostgreSQLAdapter } from "./postgresql-adapter.js";

const UUID_OID = 2950;

function makeAdapter(queryImpl: (...args: unknown[]) => Promise<unknown>): PostgreSQLAdapter {
  const adapter = new PostgreSQLAdapter({ host: "localhost", port: 1 });
  // Stub the client acquisition so tests don't touch a real pool.
  const fakeClient = { query: queryImpl, release: () => {} };
  vi.spyOn(adapter as unknown as { getClient: () => unknown }, "getClient").mockResolvedValue(
    fakeClient,
  );
  vi.spyOn(
    adapter as unknown as { releaseClient: (c: unknown) => void },
    "releaseClient",
  ).mockImplementation(() => {});
  // In a live PG adapter, loadAdditionalTypes queries pg_type and
  // aliases numeric OIDs → typnames registered in the static map.
  // Pre-register the known base OIDs so execQuery's miss path resolves
  // them without needing a DB.
  adapter.typeMap.aliasType(UUID_OID, "uuid");
  adapter.typeMap.aliasType(23, "int4");
  return adapter;
}

describe("PostgreSQLAdapter#execQuery", () => {
  let adapter: PostgreSQLAdapter;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (adapter) await adapter.close().catch(() => undefined);
  });

  it("returns a Result with columnTypes resolved from the type_map", async () => {
    adapter = makeAdapter(async () => ({
      rows: [{ id: 1, guid: "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11" }],
      fields: [
        { name: "id", dataTypeID: 23 /* int4 */ },
        { name: "guid", dataTypeID: UUID_OID },
      ],
    }));
    const result = await adapter.execQuery("SELECT id, guid FROM users");
    expect(result).toBeInstanceOf(Result);
    expect(result.columns).toEqual(["id", "guid"]);
    expect(result.columnTypes.guid).toBeInstanceOf(Uuid);
  });

  it("castValues() applies Uuid.deserialize to normalize case and braces", async () => {
    adapter = makeAdapter(async () => ({
      rows: [{ guid: "{A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11}" }],
      fields: [{ name: "guid", dataTypeID: UUID_OID }],
    }));
    const result = await adapter.execQuery("SELECT guid FROM users");
    expect(result.castValues()).toEqual(["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"]);
  });

  it("returns a Result with empty fields when the driver reports none", async () => {
    adapter = makeAdapter(async () => ({ rows: [], fields: [] }));
    const result = await adapter.execQuery("CREATE TABLE x (id int)");
    expect(result).toBeInstanceOf(Result);
    expect(result.length).toBe(0);
  });
});

describe("PostgreSQLAdapter#lookupCastTypeFromColumn", () => {
  let adapter: PostgreSQLAdapter;

  beforeEach(() => {
    adapter = new PostgreSQLAdapter({ host: "localhost", port: 1 });
    // Stub loadAdditionalTypes to avoid a DB roundtrip on miss. Tests
    // that need the miss→resolve path register the OID manually.
    vi.spyOn(adapter, "loadAdditionalTypes").mockResolvedValue(undefined);
    adapter.typeMap.aliasType(UUID_OID, "uuid");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await adapter.close().catch(() => undefined);
  });

  it("resolves the OID → Type via the type_map", async () => {
    const type = await adapter.lookupCastTypeFromColumn({ oid: UUID_OID, name: "guid" });
    expect(type).toBeInstanceOf(Uuid);
  });

  it("falls back to sqlType lookup when oid is missing", async () => {
    const type = await adapter.lookupCastTypeFromColumn({
      oid: null,
      sqlType: "uuid",
      name: "guid",
    });
    expect(type).toBeInstanceOf(Uuid);
  });

  it("returns a ValueType when neither oid nor sqlType is available", async () => {
    const type = await adapter.lookupCastTypeFromColumn({});
    expect(type).toBeInstanceOf(ValueType);
  });
});
