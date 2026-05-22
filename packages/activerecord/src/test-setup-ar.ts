/**
 * AR-only vitest setupFile. Wired into the `activerecord` project in
 * `vitest.config.ts`; the sibling `test-setup.ts` is shared with the
 * non-AR `other` project, so anything that imports the AR test adapter
 * (and thus opens a DB connection at module load) belongs here, not
 * there.
 */

// Self-registers the better-sqlite3 driver so the AR test adapter can resolve
// it via getSqlite() without each test bootstrapping the registry. Lives here
// (not in activerecord/index.ts) to keep better-sqlite3 a true optional peer
// for non-test consumers.
import "@blazetrails/activesupport/sqlite/better-sqlite3";
import { beforeEach } from "vitest";
import { resetTestAdapterState } from "./test-adapter.js";
import { shouldSkipGlobalReset } from "./test-helpers/skip-global-reset.js";
import { Base } from "./base.js";

// Bootstrap Base.connectionHandler once per worker so models that don't carry a
// direct `static { this.adapter = ... }` assignment can resolve their adapter
// via the Rails-shape handler chain (Base.adapter getter → connectionHandler →
// pool → checkout). Idempotent: isConnectedQ() short-circuits re-registration.
// test-setup-worker-db.ts runs before this module and already applies the
// per-worker slot suffix to PG_TEST_URL / MYSQL_TEST_URL.
//
// SQLite :memory: requires pool size 1: each connection is an independent
// in-memory database. A pool size > 1 would create multiple separate databases,
// causing schema-cache lookups (which checkout a connection from the pool) to
// see an empty DB while the table was created on a different connection.
// PG and MySQL are URL-based and share state across connections, so pool size
// defaults are fine there.
const _testDbUrl = process.env.PG_TEST_URL ?? process.env.MYSQL_TEST_URL ?? ":memory:";
const _isInMemorySqlite = !process.env.PG_TEST_URL && !process.env.MYSQL_TEST_URL;
if (!Base.isConnectedQ()) {
  await Base.establishConnection(
    _isInMemorySqlite ? { adapter: "sqlite3", database: ":memory:", pool: 1 } : _testDbUrl,
  );
}

// Wipe shared test-adapter state before every test. The previous lazy
// "clean up on first DB op of next test" model left a window where a
// prior test's recovery path (handleMissingSchemaError) could mutate
// _createdTables/_declaredColumns between cleanup and the next test's
// schema setup, causing intermittent failures (count→0, queries against
// stale schemas). Eager reset closes that window.
beforeEach(async () => {
  if (shouldSkipGlobalReset()) return;
  await resetTestAdapterState();
});
