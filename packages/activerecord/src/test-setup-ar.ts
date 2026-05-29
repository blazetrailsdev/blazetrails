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
import { beforeEach, afterAll } from "vitest";
import { resetTestAdapterState } from "./test-adapter.js";
import { shouldRunGlobalReset } from "./test-helpers/require-global-reset.js";

// Rails parity: schema is loaded once per suite and never reset between
// tests — per-test cleanup is transactional rollback. The PER-TEST reset is
// therefore opt-in (off by default); only files that explicitly call
// pushRequireGlobalReset() pay the full resetTestAdapterState() round-trip
// between every test. This is the structural perf win: thousands of per-test
// drops become a handful.
beforeEach(async () => {
  if (!shouldRunGlobalReset()) return;
  await resetTestAdapterState();
});

// Cross-file cleanup, always on. Setup-file hooks apply per test file, so this
// runs exactly once after each file's suite — cheap (~one drop per file, not
// per test). It guarantees a file never leaves tables or model-registry state
// behind for the next file in the same worker, which (under the shared
// per-worker DB) would otherwise bleed into a following non-opt-in file. This
// restores the cross-file isolation the old per-test reset provided as a side
// effect, without paying the per-test cost.
afterAll(async () => {
  await resetTestAdapterState();
});
