/**
 * Mirrors Rails activerecord/test/cases/adapters/postgresql/transaction_nested_test.rb
 */
import { describe, it, beforeEach, afterEach } from "vitest";
import { describeIfPg, PostgreSQLAdapter, PG_TEST_URL } from "./test-helper.js";

describeIfPg("PostgreSQLAdapter", () => {
  let adapter: PostgreSQLAdapter;
  beforeEach(async () => {
    adapter = new PostgreSQLAdapter(PG_TEST_URL);
  });
  afterEach(async () => {
    await adapter.close();
  });

  describe("PostgreSQLTransactionNestedTest", () => {
    it.skip("nested transaction rollback", async () => {});
    it.skip("nested transaction commit", async () => {});
    it.skip("double nested transaction", async () => {});
    it.skip("nested transaction with savepoint", async () => {});
    it.skip("unserializable transaction raises SerializationFailure inside nested SavepointTransaction", async () => {});
    it.skip("SerializationFailure inside nested SavepointTransaction is recoverable", async () => {});
    it.skip("deadlock raises Deadlocked inside nested SavepointTransaction", async () => {});

    it.skip("deadlock inside nested SavepointTransaction is recoverable", () => {
      // BLOCKED: adapter-pg — PostgreSQL-specific adapter gap in transaction-nested
      // ROOT-CAUSE: adapters/postgresql/transaction-nested.ts missing or incomplete Rails parity
      // SCOPE: ~50–200 LOC fix in adapters/postgresql/transaction-nested.ts; affects ~10–47 tests in transaction-nested.test.ts
    });
  });
});
