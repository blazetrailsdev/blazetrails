/**
 * Opt-in refcount for the global `beforeEach` reset in test-setup-ar.ts.
 *
 * Rails parity: schema is loaded once at suite start (`db:test:prepare`) and
 * never reset between tests — per-test cleanup is transactional rollback. The
 * global `resetTestAdapterState()` (which drops every table via a DB
 * round-trip *and* wipes the in-memory model registry) is therefore OFF by
 * default. A file that genuinely needs a full reset between tests — e.g. raw
 * DDL that auto-commits and can't be rolled back, or models redefined per
 * test — opts in via `pushRequireGlobalReset` / `popRequireGlobalReset`.
 *
 * Refcounted (not a bool) so nested describes / multiple suites that each opt
 * in don't clobber an outer scope's request when an inner scope's afterAll
 * runs. Mirrors Rails ConnectionPool's `@pinned_connections_depth`
 * (connection_pool.rb:327, 345).
 *
 * @internal
 */

let _requireGlobalResetDepth = 0;

/** @internal */
export function pushRequireGlobalReset(): void {
  _requireGlobalResetDepth += 1;
}

/** @internal */
export function popRequireGlobalReset(): number {
  if (_requireGlobalResetDepth > 0) _requireGlobalResetDepth -= 1;
  return _requireGlobalResetDepth;
}

/** @internal */
export function shouldRunGlobalReset(): boolean {
  return _requireGlobalResetDepth > 0;
}
