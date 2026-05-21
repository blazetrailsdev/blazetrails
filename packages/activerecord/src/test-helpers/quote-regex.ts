/**
 * Test helpers for writing adapter-agnostic SQL assertions.
 *
 * Mirrors Rails' canonical pattern. In `activerecord/test/cases/relation/`
 * Rails inlines the regex-escaped quoted identifier directly:
 *
 *     assert_match %r{ ... #{Regexp.escape(quote_table_name("posts.title"))} ... }, sql
 *
 * Or hoists a one-character lambda when a test has several identifiers:
 *
 *     q = -> name { Regexp.escape(quote_table_name(name)) }
 *     expected = %r/\ASELECT 1 AS #{q["a"]}, foo\(\) AS #{q["b"]} FROM/
 *
 * Rails uses `quote_table_name` (never `quote_column_name`) in these
 * regex assertions — `quote_table_name` handles both bare (`"name"`) and
 * dotted (`"posts"."title"`) identifiers, so it's the universal helper.
 *
 * `q(name)` is the trails equivalent of that Rails lambda. Dispatch reads
 * the live adapter via {@link adapterType} so MySQL emits backticks,
 * PG/SQLite emit ANSI double-quotes. Adding a fourth adapter only requires
 * extending the switch with its `quoteTableName` impl — no hard-coded
 * "canonical" form, no post-hoc string rewriting.
 */

import * as mysqlQuoting from "../connection-adapters/mysql/quoting.js";
import * as pgQuoting from "../connection-adapters/postgresql/quoting.js";
import * as sqliteQuoting from "../connection-adapters/sqlite3/quoting.js";
import { adapterType } from "../test-adapter.js";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Active adapter's `quoteTableName(name)` — unescaped. Handles dotted names. */
export function quoteTableName(name: string): string {
  switch (adapterType) {
    case "mysql":
      return mysqlQuoting.quoteTableName(name);
    case "postgres":
      return pgQuoting.quoteTableName(name);
    case "sqlite":
      return sqliteQuoting.quoteTableName(name);
  }
}

/** Active adapter's `quoteColumnName(name)` — unescaped. Single segment only. */
export function quoteColumnName(name: string): string {
  switch (adapterType) {
    case "mysql":
      return mysqlQuoting.quoteColumnName(name);
    case "postgres":
      return pgQuoting.quoteColumnName(name);
    case "sqlite":
      return sqliteQuoting.quoteColumnName(name);
  }
}

/**
 * Regex-escaped quoted identifier for the active adapter — mirrors
 * Rails' `q = -> name { Regexp.escape(quote_table_name(name)) }` lambda.
 * Accepts both bare and dotted names.
 *
 * @example
 *     expect(sql).toMatch(new RegExp(`SELECT ${q("posts.title")} FROM ${q("posts")}`));
 */
export function q(name: string): string {
  return escapeRegExp(quoteTableName(name));
}
