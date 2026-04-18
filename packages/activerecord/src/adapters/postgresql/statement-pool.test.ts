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
      // Rails' equivalent stubs `get_last_result` to raise after PREPARE,
      // simulating a lost ack while the server has the statement. pg-js
      // doesn't expose that hook, so we test the closest observable
      // property: an execute-time error (outside a transaction, so the
      // session is still usable) must not prevent a later query from
      // reusing the prepared plan. Mirrors the spirit of
      // `test_prepared_statements_do_not_get_stuck_on_query_interruption`
      // in activerecord/test/cases/adapters/postgresql/statement_pool_test.rb.
      await expect(adapter.execute("SELECT 1 / $1::int", [0])).rejects.toThrow();
      // The adapter still serves queries with the same SQL shape after
      // the error — no pool poisoning, no duplicate-prepared-statement
      // error on reuse.
      const rows = await adapter.execute("SELECT 1 / $1::int", [1]);
      expect(rows[0]).toBeDefined();
    });

    it("PreparedStatementCacheExpired is exported for txn-retry callers", async () => {
      // In-txn `exec_cache` can't transparently retry a cached-plan
      // failure — any error aborts the enclosing txn, so subsequent
      // commands raise 25P02 InFailedSqlTransaction. Rails raises
      // `PreparedStatementCacheExpired` for the transaction machinery
      // to catch and retry the whole txn. Triggering a real 0A000
      // requires DDL on a referenced object between two queries in
      // the same txn (covered by txn retry suite); here we just
      // verify the error class round-trips.
      const { PreparedStatementCacheExpired } = await import("../../errors.js");
      expect(new PreparedStatementCacheExpired("test").name).toBe("PreparedStatementCacheExpired");
    });
  });
});
