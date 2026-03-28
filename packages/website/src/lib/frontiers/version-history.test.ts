import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { SqlJsAdapter } from "./sql-js-adapter.js";
import { VersionHistory } from "./version-history.js";

let adapter: SqlJsAdapter;
let history: VersionHistory;

beforeEach(async () => {
  const SQL = await initSqlJs();
  adapter = new SqlJsAdapter(new SQL.Database());
  history = new VersionHistory(adapter);
});

describe("VersionHistory", () => {
  it("starts empty", () => {
    expect(history.list()).toEqual([]);
    expect(history.count()).toBe(0);
  });

  it("saves and lists snapshots", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    history.save(data, "first");
    history.save(data, "second");

    const list = history.list();
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe("second"); // most recent first
    expect(list[1].label).toBe("first");
  });

  it("loads a snapshot and decompresses it", () => {
    const data = new Uint8Array(100);
    for (let i = 0; i < 100; i++) data[i] = i % 256;

    const id = history.save(data, "test");
    const loaded = history.load(id);

    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(data);
  });

  it("returns null for nonexistent snapshot", () => {
    expect(history.load(999)).toBeNull();
  });

  it("deletes a snapshot", () => {
    const id = history.save(new Uint8Array([1]), "x");
    expect(history.count()).toBe(1);
    history.delete(id);
    expect(history.count()).toBe(0);
  });

  it("prunes old snapshots beyond max", () => {
    const smallHistory = new VersionHistory(adapter, { maxSnapshots: 3 });
    for (let i = 0; i < 5; i++) {
      smallHistory.save(new Uint8Array([i]), `snap-${i}`);
    }
    expect(smallHistory.count()).toBe(3);
    const list = smallHistory.list();
    expect(list[0].label).toBe("snap-4");
    expect(list[2].label).toBe("snap-2");
  });

  it("stores compressed data (smaller than original)", () => {
    // A large-ish payload with repetitive data compresses well
    const data = new Uint8Array(10000);
    data.fill(42);

    history.save(data, "big");
    const list = history.list();
    // Stored size should be much less than 10000
    expect(list[0].size).toBeLessThan(1000);
  });

  it("round-trips data through compression", () => {
    // Random-ish data
    const data = new Uint8Array(500);
    for (let i = 0; i < 500; i++) data[i] = (i * 7 + 13) % 256;

    const id = history.save(data, "random");
    const loaded = history.load(id)!;
    expect(loaded).toEqual(data);
  });
});
