/**
 * Mirrors Rails activerecord/test/cases/adapters/postgresql/statement_pool_test.rb
 */
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import { describeIfPg, PostgreSQLAdapter, PG_TEST_URL } from "./test-helper.js";

describeIfPg("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  beforeEach(async () => {
    adapter = new PostgreSQLAdapter(PG_TEST_URL);
    adapter.preparedStatements = true;
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("StatementPoolTest", () => {
    it("statement pool", async () => {
      await adapter.beginDbTransaction();
      try {
        await adapter.execute("SELECT $1::int", [1]);
        await adapter.execute("SELECT $1::int", [2]);
        const pool = adapter._statementPoolForTest()!;
        expect(pool).toBeDefined();
        expect(pool.length).toBe(1);

        await adapter.execute("SELECT $1::text", ["a"]);
        expect(pool.length).toBe(2);
      } finally {
        await adapter.rollback();
      }
    });

    it("statement pool max", async () => {
      await adapter.beginDbTransaction();
      try {
        await adapter.execute("SELECT $1::int", [1]);
        const pool = adapter._statementPoolForTest()!;
        // Force eviction by shrinking the pool. Rails uses
        // statement_limit = 1 in the matching test.
        (pool as unknown as { _maxSize: number })._maxSize = 1;
        await adapter.execute("SELECT $1::text", ["a"]);
        expect(pool.length).toBe(1);
      } finally {
        await adapter.rollback();
      }
    });

    it("statement pool clear", async () => {
      await adapter.beginDbTransaction();
      try {
        await adapter.execute("SELECT $1::int", [1]);
        await adapter.execute("SELECT $1::text", ["a"]);
        const pool = adapter._statementPoolForTest()!;
        expect(pool.length).toBe(2);
        pool.clear();
        expect(pool.length).toBe(0);
      } finally {
        await adapter.rollback();
      }
    });

    it("dealloc does not raise on inactive connection", async () => {
      await adapter.beginDbTransaction();
      await adapter.execute("SELECT $1::int", [1]);
      const pool = adapter._statementPoolForTest()!;
      await adapter.rollback();
      // Client has been released; DEALLOCATE against a detached pool
      // must be a no-op rather than an unhandled rejection.
      expect(() => pool.clear()).not.toThrow();
    });

    it("prepared statements do not get stuck on query interruption", async () => {
      await adapter.beginDbTransaction();
      try {
        // Simulate an interruption: a prepared statement that errors
        // (division by zero) must not poison the pool — a subsequent
        // query on the same text must succeed by re-preparing.
        await expect(adapter.execute("SELECT 1 / $1::int", [0])).rejects.toThrow();
        const pool = adapter._statementPoolForTest()!;
        // The entry still exists in the pool after the error — that's
        // fine; the server kept the prepared plan. Running the same
        // statement shape with a valid value succeeds on reuse.
        const before = pool.length;
        const rows = await adapter.execute("SELECT 1 / $1::int", [1]);
        expect(rows[0]).toBeDefined();
        expect(pool.length).toBeGreaterThanOrEqual(before);
      } finally {
        await adapter.rollback();
      }
    });
  });
});
