export interface CanonicalQuery {
  version: 1;
  /** Fixture identifier, e.g. "arel-01" */
  fixture: string;
  /** ISO 8601 UTC — the time both sides were frozen to */
  frozenAt: string;
  /** SQL produced by to_sql / toSql() on the query expression — all values inlined */
  sql: string;
  /**
   * Optional. Parameterized SQL with `?` only for datetime values; non-datetime
   * scalars are re-inlined so `?` count equals `binds.length`. May equal `sql`
   * when no datetime binds are present. Currently not compared cross-side
   * (informational only) — Rails SQLite inlines datetime values in `to_sql`
   * so `bound_attributes` is empty there, making cross-side bind comparison
   * structurally asymmetric.
   */
  paramSql?: string;
  /** Ordered datetime bind values as ISO 8601 UTC strings. Currently informational only. */
  binds: string[];
}
