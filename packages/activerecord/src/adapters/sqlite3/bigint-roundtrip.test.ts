import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLite3Adapter } from "../../connection-adapters/sqlite3-adapter.js";

let adapter: SQLite3Adapter;

beforeEach(() => {
  adapter = new SQLite3Adapter(":memory:");
  adapter.exec(`
    CREATE TABLE "big_items" (
      "id"    INTEGER PRIMARY KEY AUTOINCREMENT,
      "score" BIGINT NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 0
    )
  `);
});

afterEach(() => {
  adapter.close();
});

describe("SQLite3 bigint round-trip", () => {
  const BIG = 2n ** 62n; // 4611686018427387904 — well above Number.MAX_SAFE_INTEGER

  it("returns bigint for BIGINT column", async () => {
    await adapter.executeMutation(`INSERT INTO "big_items" ("score", "count") VALUES (?, ?)`, [
      BIG,
      1,
    ]);
    const rows = await adapter.execute(`SELECT "score", "count" FROM "big_items"`);
    expect(typeof rows[0].score).toBe("bigint");
    expect(rows[0].score).toBe(BIG);
  });

  it("preserves exact value above Number.MAX_SAFE_INTEGER", async () => {
    const unsafe = 9007199254740993n; // Number.MAX_SAFE_INTEGER + 2
    await adapter.executeMutation(`INSERT INTO "big_items" ("score", "count") VALUES (?, ?)`, [
      unsafe,
      0,
    ]);
    const rows = await adapter.execute(`SELECT "score" FROM "big_items"`);
    expect(rows[0].score).toBe(unsafe);
  });

  it("returns bigint for INTEGER column in same row when safeIntegers is enabled", async () => {
    await adapter.executeMutation(`INSERT INTO "big_items" ("score", "count") VALUES (?, ?)`, [
      BIG,
      42,
    ]);
    const rows = await adapter.execute(`SELECT "score", "count" FROM "big_items"`);
    // safeIntegers applies to the whole statement — INTEGER columns also return bigint.
    // IntegerType.cast coerces bigint → number at the model attribute layer.
    expect(typeof rows[0].count).toBe("bigint");
    expect(rows[0].count).toBe(42n);
  });

  it("update round-trip preserves value", async () => {
    await adapter.executeMutation(`INSERT INTO "big_items" ("score", "count") VALUES (?, ?)`, [
      BIG,
      0,
    ]);
    await adapter.executeMutation(`UPDATE "big_items" SET "score" = ?`, [BIG + 1n]);
    const rows = await adapter.execute(`SELECT "score" FROM "big_items"`);
    expect(rows[0].score).toBe(BIG + 1n);
  });
});
