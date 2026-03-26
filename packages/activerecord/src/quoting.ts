/**
 * Quote a SQL identifier (table name, column name, index name).
 * Uses double quotes for SQLite/PG, backticks for MySQL.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Quoting#quote_column_name
 */
export function quoteIdentifier(name: string, adapter?: "sqlite" | "postgres" | "mysql"): string {
  if (adapter === "mysql") {
    return `\`${name.replace(/`/g, "``")}\``;
  }
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Quote a table name. Handles schema-qualified names (schema.table).
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Quoting#quote_table_name
 */
export function quoteTableName(name: string, adapter?: "sqlite" | "postgres" | "mysql"): string {
  return name
    .split(".")
    .map((part) => quoteIdentifier(part, adapter))
    .join(".");
}

/**
 * Quote a value for use in SQL.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Quoting#quote
 */
export function quote(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Quote a column default expression for use in DDL.
 *
 * In Rails, proc/lambda defaults produce raw SQL expressions (e.g.
 * `-> { "CURRENT_TIMESTAMP" }`). All other values are quoted as literals.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::AbstractAdapter#quote_default_expression
 */
export function quoteDefaultExpression(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "function") return ` DEFAULT ${value()}`;
  return ` DEFAULT ${quote(value)}`;
}
