export interface CanonicalQuery {
  version: 1;
  /** Fixture identifier, e.g. "arel-01" */
  fixture: string;
  /** ISO 8601 UTC — the time both sides were frozen to */
  frozenAt: string;
  /** SQL produced by to_sql / toSql() on the query expression — all values inlined */
  sql: string;
  /**
   * Optional. Parameterized SQL template with `?` placeholders for datetime bind values.
   * - trails: built by calling `compileWithBinds` on the adapter-specific Arel visitor,
   *   then re-inlining non-Date binds so `?` count = `binds.length`.
   * - Rails: built via `Arel::Collectors::Bind` + the connection visitor when
   *   `bound_attributes` contains datetime values; equals `sql` otherwise.
   * Not compared cross-side (informational only). Omitted for arel-* fixtures.
   */
  paramSql?: string;
  /** Ordered bind values, all stringified. Populated alongside paramSql. */
  binds: string[];
}
