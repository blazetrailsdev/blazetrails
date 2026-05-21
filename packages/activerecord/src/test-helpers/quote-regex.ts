/**
 * Test helpers for writing adapter-agnostic SQL assertions.
 *
 * Mirrors Rails' canonical pattern:
 *
 *     assert_match %r{... #{Regexp.escape(quote_column_name("name"))} ...}, sql
 *
 * `q(name)` returns the active adapter's quoted identifier with regex
 * metacharacters escaped, so it composes inside `RegExp` patterns. `qt(name)`
 * is the same for dotted `table.column` identifiers.
 *
 * Dispatch reads from {@link adapterType} so the live adapter's quoting is
 * the source of truth — no hard-coded ANSI canonical form, no post-hoc
 * string rewriting. Adding a fourth adapter only requires extending the
 * switch with its `quoteColumnName` / `quoteTableName`.
 */

import * as mysqlQuoting from "../connection-adapters/mysql/quoting.js";
import * as pgQuoting from "../connection-adapters/postgresql/quoting.js";
import * as sqliteQuoting from "../connection-adapters/sqlite3/quoting.js";
import { adapterType } from "../test-adapter.js";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Active adapter's `quoteColumnName(name)` — unescaped. */
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

/** Active adapter's `quoteTableName(name)` — unescaped. */
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

/**
 * Regex-escaped quoted column identifier for the active adapter.
 *
 * @example
 *     expect(sql).toMatch(new RegExp(`SELECT ${q("name")} FROM ${qt("users")}`));
 */
export function q(name: string): string {
  return escapeRegExp(quoteColumnName(name));
}

/** Regex-escaped quoted table identifier for the active adapter. */
export function qt(name: string): string {
  return escapeRegExp(quoteTableName(name));
}
