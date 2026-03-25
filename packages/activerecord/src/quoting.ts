/**
 * Quote a SQL identifier (table name, column name, index name).
 * Doubles embedded double-quote characters, matching Rails' SQLite/PG quoting.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Quoting#quote_column_name
 */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Quote a table name. Handles schema-qualified names (schema.table).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::Quoting#quote_table_name
 */
export function quoteTableName(name: string): string {
  return name
    .split(".")
    .map((part) => quoteIdentifier(part))
    .join(".");
}
