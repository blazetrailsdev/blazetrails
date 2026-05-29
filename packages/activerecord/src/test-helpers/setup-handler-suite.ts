import { beforeAll, beforeEach } from "vitest";
import { bootstrapTestHandler, syncHandlerVisitor } from "./bootstrap-test-handler.js";

/**
 * One-call wiring for D-1..N handler-resolved test files.
 *
 * Bootstraps `Base.connectionHandler` once per worker. The global
 * `resetTestAdapterState()` beforeEach is opt-in and off by default, so
 * shared-DB tables already survive across tests in the file without any
 * opt-out. Mirrors Rails' `setup_fixtures` / `teardown_fixtures` pattern at
 * the test-case level.
 *
 * @internal
 */
export function setupHandlerSuite(): void {
  beforeAll(async () => {
    await bootstrapTestHandler();
  });
  // Re-sync after every test because test-setup.ts afterEach resets the
  // global visitor to the default Visitors.ToSql.
  beforeEach(() => {
    syncHandlerVisitor();
  });
}
