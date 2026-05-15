import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import type { DatabaseAdapter } from "../adapter.js";
import { setSkipGlobalReset, type TestDatabaseAdapter } from "../test-adapter.js";
import { dropAllTables } from "./drop-all-tables.js";

function tm(adapter: DatabaseAdapter): {
  beginTransaction: (opts: { joinable: boolean; _lazy: boolean }) => Promise<unknown>;
  rollbackTransaction: () => Promise<void>;
  openTransactions: number;
} {
  const inner = (adapter as TestDatabaseAdapter).innerAdapter ?? adapter;
  return (inner as unknown as { transactionManager: ReturnType<typeof tm> }).transactionManager;
}

/**
 * Wrap every test in a top-level transaction that rolls back in `afterEach`,
 * so data inserted/updated during the test is discarded without re-running
 * schema DDL between tests.
 *
 * Mirrors Rails' transactional fixtures (`ActiveRecord::TestFixtures`:
 * `setup_fixtures` opens a transaction; `teardown_fixtures` rolls back).
 *
 * Files calling this helper opt out of the global `resetTestAdapterState`
 * beforeEach (in `test-setup-ar.ts`) for their duration, so a one-time
 * schema set up in `beforeAll` survives across tests. The helper drops any
 * tables left behind in its own `afterAll` so other files are unaffected.
 *
 * Caller contract:
 *   - Set up schema in `beforeAll` *before* calling this helper, or inside
 *     each test (which then rolls back).
 *   - On MySQL, DDL auto-commits and escapes the wrap. Schema work must
 *     happen in `beforeAll` (not in a test body) on MySQL.
 *
 * Nested `transaction { ... }` calls inside a test become savepoints because
 * the outer transaction is opened with `joinable: false`.
 *
 * @example
 *   let adapter: TestDatabaseAdapter;
 *   beforeAll(async () => {
 *     adapter = createTestAdapter();
 *     await adapter.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);
 *   });
 *   withTransactionalFixtures(() => adapter);
 *
 *   it("inserts a user", async () => { ... });  // rolled back in afterEach
 */
export function withTransactionalFixtures(getAdapter: () => DatabaseAdapter): void {
  beforeAll(() => {
    setSkipGlobalReset(true);
  });

  afterAll(async () => {
    setSkipGlobalReset(false);
    const adapter = getAdapter();
    const inner = (adapter as TestDatabaseAdapter).innerAdapter ?? adapter;
    await dropAllTables(inner);
  });

  beforeEach(async () => {
    // Mirrors Rails ConnectionPool#pin_connection!:
    //   @pinned_connection.begin_transaction joinable: false, _lazy: false
    await tm(getAdapter()).beginTransaction({ joinable: false, _lazy: false });
  });

  afterEach(async () => {
    const t = tm(getAdapter());
    while (t.openTransactions > 0) await t.rollbackTransaction();
  });
}
