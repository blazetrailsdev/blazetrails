import { setToSqlVisitor, Visitors, type Nodes } from "@blazetrails/arel";
import { normalizeAdapterName } from "./connection-adapters/adapter-args.js";

/**
 * Keep the process-global Arel `toSql` visitor (the fallback used by
 * `Node#toSql()` / `TreeManager#toSql()` for code paths that lack adapter
 * context) pointed at whichever dialect the currently-established connection
 * speaks.
 *
 * trails has no Rails analog here — Rails compiles via `connection.visitor`
 * and has no global visitor. This module exists only so the global fallback
 * doesn't drift away from the established connection's dialect.
 *
 * @internal
 */

type VisitorClass = new () => { compile(node: Nodes.Node): string };

/**
 * Maps a {@link normalizeAdapterName} result to the dialect visitor class the
 * matching adapter installs in its `arelVisitor()`:
 *   - `sqlite`     → {@link Visitors.SQLite}              (sqlite3-adapter.ts)
 *   - `postgresql` → {@link Visitors.PostgreSQLWithBinds} (postgresql-adapter.ts)
 *   - `mysql`      → {@link Visitors.MySQL}               (abstract-mysql-adapter.ts)
 *
 * Drift between this map and the adapters' `arelVisitor()` is guarded by
 * `arel-visitor-sync.test.ts`.
 *
 * @internal
 */
const VISITOR_BY_ADAPTER: Record<string, VisitorClass> = {
  sqlite: Visitors.SQLite as unknown as VisitorClass,
  postgresql: Visitors.PostgreSQLWithBinds as unknown as VisitorClass,
  mysql: Visitors.MySQL as unknown as VisitorClass,
};

const DEFAULT_VISITOR = Visitors.ToSql as unknown as VisitorClass;

let _establishedVisitor: VisitorClass | null = null;

/** @internal */
export function visitorClassForAdapter(adapterName: string): VisitorClass | undefined {
  return VISITOR_BY_ADAPTER[normalizeAdapterName(adapterName)];
}

/**
 * Record the dialect of a newly-established connection and install its visitor
 * globally. Synchronous and connection-free — derived from the adapter name,
 * so it never checks out a pooled connection (preserving Rails' lazy-connect
 * semantics and sidestepping the SQLite `:memory: pool:1` checkout deadlock).
 *
 * Unknown adapters fall back to the default {@link Visitors.ToSql}.
 *
 * @internal
 */
export function installAdapterVisitor(adapterName: string): void {
  const klass = visitorClassForAdapter(adapterName);
  _establishedVisitor = klass ?? null;
  setToSqlVisitor(klass ?? DEFAULT_VISITOR);
}

/**
 * Forget the established dialect and reset the global visitor to the default.
 * Paired with `removeConnection`.
 *
 * @internal
 */
export function clearAdapterVisitor(): void {
  _establishedVisitor = null;
  setToSqlVisitor(DEFAULT_VISITOR);
}

/**
 * Restore the global visitor to the established connection's dialect, or the
 * default {@link Visitors.ToSql} when nothing is established. Called from
 * `test-setup.ts`'s `afterEach`: AR handler-suite tests keep their dialect
 * visitor across tests without a per-file `beforeEach` re-sync, while non-AR
 * tests (no established connection) still reset to a clean default so a
 * dialect can't leak between unrelated arel-package tests.
 *
 * @internal
 */
export function restoreEstablishedVisitor(): void {
  setToSqlVisitor(_establishedVisitor ?? DEFAULT_VISITOR);
}
