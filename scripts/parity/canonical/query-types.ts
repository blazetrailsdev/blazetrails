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
   * - trails: built via `compileWithBinds` using the adapter-specific Arel visitor.
   * - Rails: built via `Arel::Collectors::Bind` with the connection visitor.
   * When present, compared cross-side alongside `binds` instead of `sql`.
   * Omitted for arel-* fixtures (no datetime binds).
   */
  paramSql?: string;
  /** Ordered bind values, all stringified. Populated alongside paramSql. */
  binds: string[];
}
