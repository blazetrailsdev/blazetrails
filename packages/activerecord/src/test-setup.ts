import { afterEach, beforeEach } from "vitest";
import { setToSqlVisitor, Visitors } from "@blazetrails/arel";
import { resetTestAdapterState } from "./test-adapter.js";

// Restore the default Arel visitor after each test so AR tests that set a
// SQLite (or other dialect) adapter via `Base.adapter = ...` don't leak the
// dialect-specific visitor into unrelated arel tests running in the same
// process. Tests that need a dialect visitor for their duration already
// manage it themselves (see node.test.ts's try/finally pattern).
afterEach(() => {
  setToSqlVisitor(Visitors.ToSql);
});

// Wipe shared test-adapter state before every test. The previous lazy
// "clean up on first DB op of next test" model left a window where a
// prior test's recovery path (handleMissingSchemaError) could mutate
// _createdTables/_declaredColumns between cleanup and the next test's
// schema setup, causing intermittent failures (count→0, queries against
// stale schemas). Eager reset closes that window.
beforeEach(async () => {
  await resetTestAdapterState();
});
