/**
 * Format a column default value into a SQL DEFAULT clause.
 *
 * Handles SQL expression defaults (e.g. CURRENT_TIMESTAMP, now(), uuid_generate_v4())
 * without quoting them as string literals.
 */
export function formatDefaultClause(defaultValue: unknown): string {
  if (defaultValue === undefined) return "";
  if (defaultValue === null) return " DEFAULT NULL";
  if (typeof defaultValue === "boolean") return ` DEFAULT ${defaultValue ? "TRUE" : "FALSE"}`;
  if (typeof defaultValue === "number") return ` DEFAULT ${defaultValue}`;
  if (typeof defaultValue === "function") return ` DEFAULT ${defaultValue()}`;
  const str = String(defaultValue).trim();
  if (/^[A-Z_]+(?:\(\d*\))?$/.test(str)) return ` DEFAULT ${str}`;
  if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(.*\)$/.test(str)) return ` DEFAULT ${str}`;
  return ` DEFAULT '${str.replace(/'/g, "''")}'`;
}
