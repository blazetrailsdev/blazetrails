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
import { shouldRunGlobalReset } from "./test-helpers/require-global-reset.js";

// Rails parity: schema is loaded once per suite and never reset between
// tests — per-test cleanup is transactional rollback. The PER-TEST reset is
// therefore opt-in (off by default); only files that opt in via
// useGlobalReset() pay the full resetTestAdapterState() round-trip between
// every test. This is the structural perf win: thousands of per-test drops
// become a handful. Those opt-in files also run one final reset in their own
// afterAll (see useGlobalReset), and transactional-fixtures files reset on
// their way out, so a file never leaves state behind for the next file in the
// same worker. Files that manage their own raw adapters are left untouched —
// forcing a pool reset through them deadlocks on PostgreSQL.
beforeEach(async () => {
  if (!shouldRunGlobalReset()) return;
  await resetTestAdapterState();
});
