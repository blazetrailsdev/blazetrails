import { StringType, ValueType } from "@blazetrails/activemodel";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HashLookupTypeMap } from "../type/hash-lookup-type-map.js";
import { Uuid } from "./postgresql/oid/uuid.js";
import { PostgreSQLAdapter } from "./postgresql-adapter.js";

describe("PostgreSQLAdapter#typeMap", () => {
  let adapter: PostgreSQLAdapter;

  beforeEach(() => {
    // No real connection needed — we never execute SQL in these tests.
    adapter = new PostgreSQLAdapter({ host: "localhost", port: 1 });
  });

  afterEach(async () => {
    await adapter.close().catch(() => undefined);
  });

  it("is a HashLookupTypeMap populated with known PG types", () => {
    expect(adapter.typeMap).toBeInstanceOf(HashLookupTypeMap);
    expect(adapter.typeMap.lookup("uuid")).toBeInstanceOf(Uuid);
    expect(adapter.typeMap.lookup("text")).toBeInstanceOf(StringType);
  });

  it("is memoized across calls", () => {
    const first = adapter.typeMap;
    const second = adapter.typeMap;
    expect(first).toBe(second);
  });
});

describe("PostgreSQLAdapter#getOidType", () => {
  let adapter: PostgreSQLAdapter;

  beforeEach(() => {
    adapter = new PostgreSQLAdapter({ host: "localhost", port: 1 });
  });

  afterEach(async () => {
    await adapter.close().catch(() => undefined);
  });

  it("returns the registered type for a known OID", () => {
    // Register a fake OID → Uuid mapping (the adapter type_map is keyed
    // by both string typnames and integer OIDs, matching Rails Hash
    // semantics).
    adapter.typeMap.registerType(2950, new Uuid());
    const type = adapter.getOidType(2950, -1, "guid");
    expect(type).toBeInstanceOf(Uuid);
  });

  it("warns and registers a fallback ValueType for an unknown OID", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const type = adapter.getOidType(999_999, -1, "mystery_column");
    expect(type).toBeInstanceOf(ValueType);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("unknown OID 999999"));
    // Subsequent lookup returns the same fallback without re-warning.
    spy.mockClear();
    const second = adapter.getOidType(999_999, -1, "mystery_column");
    expect(second).toBeInstanceOf(ValueType);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
