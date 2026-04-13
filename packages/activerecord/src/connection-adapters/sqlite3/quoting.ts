/**
 * SQLite3 quoting — SQLite-specific value and identifier quoting.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::Quoting
 */

export interface Quoting {
  quotedTrue(): string;
  unquotedTrue(): number;
  quotedFalse(): string;
  unquotedFalse(): number;
  quotedDate(date: Date): string;
  quotedTimeUtc(date: Date): string;
  quoteTableName(name: string): string;
  quoteColumnName(name: string): string;
  quoteString(value: string): string;
}

export function quotedTrue(): string {
  return "1";
}

export function unquotedTrue(): number {
  return 1;
}

export function quotedFalse(): string {
  return "0";
}

export function unquotedFalse(): number {
  return 0;
}

export function quotedDate(date: Date): string {
  return `'${date.toISOString().split("T")[0]}'`;
}

export function quotedTimeUtc(date: Date): string {
  return `'${date.toISOString().replace("T", " ").replace("Z", "")}'`;
}

export function quoteTableName(name: string): string {
  return name
    .split(".")
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(".");
}

export function quoteColumnName(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function quote(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return quoteString(value);
  if (typeof value === "boolean") return value ? quotedTrue() : quotedFalse();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return quoteString(String(value));
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "symbol") {
    if (value.description === undefined) {
      throw new TypeError("can't quote a Symbol without a description");
    }
    return quoteString(value.description);
  }
  if (value instanceof Date) return quotedTimeUtc(value);
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return quotedBinary(value);
  }
  throw new TypeError(`can't quote ${Object.prototype.toString.call(value)}`);
}

export function quoteTableNameForAssignment(_table: string, attr: string): string {
  return quoteColumnName(attr);
}

export function quotedTime(value: Date): string {
  const h = String(value.getUTCHours()).padStart(2, "0");
  const m = String(value.getUTCMinutes()).padStart(2, "0");
  const s = String(value.getUTCSeconds()).padStart(2, "0");
  return `'2000-01-01 ${h}:${m}:${s}'`;
}

export function quotedBinary(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `x'${hex}'`;
}

export function quoteDefaultExpression(value: unknown): string {
  if (value === undefined || value === null) return "NULL";
  if (typeof value === "function") {
    const result = (value as () => unknown)();
    if (result === undefined || result === null) return "NULL";
    const str = String(result);
    if (/^\w+\(.*\)$/.test(str)) return `(${str})`;
    return str;
  }
  return quote(value);
}

export function typeCast(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? unquotedTrue() : unquotedFalse();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" || typeof value === "bigint") return value;
  if (typeof value === "symbol") return value.description ?? null;
  if (value instanceof Date || value instanceof Uint8Array || value instanceof ArrayBuffer)
    return value;
  throw new TypeError(`can't cast ${Object.prototype.toString.call(value)} to a SQLite3 type`);
}

// Rails uses recursive regex \g<2> to match nested function calls like
// COALESCE(a, b) or COUNT(DISTINCT name). JS doesn't support recursive
// patterns, so we use a regex that allows balanced parentheses to any
// depth by matching non-paren content or nested paren groups.
const PAREN_EXPR = `(?:\\w+\\([^()]*(?:\\([^()]*\\)[^()]*)*\\))`;
const COLUMN_EXPR = `(?:(?:\\w+\\.|"\\w+"\\.)?(\\w+|"\\w+")|${PAREN_EXPR})`;

export const COLUMN_NAME_MATCHER = new RegExp(
  `^(?:${COLUMN_EXPR}(?:(?:\\s+AS)?\\s+(?:\\w+|"\\w+"))?)` +
    `(?:\\s*,\\s*${COLUMN_EXPR}(?:(?:\\s+AS)?\\s+(?:\\w+|"\\w+"))?)*$`,
  "i",
);

export const COLUMN_NAME_WITH_ORDER_MATCHER = new RegExp(
  `^(?:${COLUMN_EXPR}(?:\\s+COLLATE\\s+(?:\\w+|"\\w+"))?(?:\\s+ASC|\\s+DESC)?(?:\\s+NULLS\\s+(?:FIRST|LAST))?)` +
    `(?:\\s*,\\s*${COLUMN_EXPR}(?:\\s+COLLATE\\s+(?:\\w+|"\\w+"))?(?:\\s+ASC|\\s+DESC)?(?:\\s+NULLS\\s+(?:FIRST|LAST))?)*$`,
  "i",
);

export function columnNameMatcher(): RegExp {
  return COLUMN_NAME_MATCHER;
}

export function columnNameWithOrderMatcher(): RegExp {
  return COLUMN_NAME_WITH_ORDER_MATCHER;
}
