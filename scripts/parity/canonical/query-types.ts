export interface CanonicalQuery {
  version: 1;
  /** Fixture identifier, e.g. "arel-01" */
  fixture: string;
  /** ISO 8601 UTC — the time both sides were frozen to */
  frozenAt: string;
  /** SQL produced by to_sql / toSql() on the query expression — all values inlined */
  sql: string;
  /**
   * Parameterized SQL template with `?` placeholders for bind-extracted values
   * (dates, etc.). Populated when the visitor's compileWithBinds path is used.
   * On the Rails side this comes from `connection.unprepared_statement { rel.to_sql }`
   * for the inlined form, and `bound_attributes` for the binds.
   */
  paramSql: string;
  /** Ordered bind values, all stringified. Populated alongside paramSql. */
  binds: string[];
}
