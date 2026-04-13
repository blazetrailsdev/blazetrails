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
  if (value === undefined) return "";
  if (value === null) return "NULL";
  if (typeof value === "function") {
    const result = (value as () => unknown)();
    if (result === undefined) return "";
    if (result === null) return "NULL";
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
// regex patterns, so we use a function-based matcher that walks balanced
// parentheses to arbitrary depth.

function skipBalancedParens(s: string, pos: number): number {
  if (s[pos] !== "(") return -1;
  let depth = 1;
  let i = pos + 1;
  while (i < s.length && depth > 0) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    i++;
  }
  return depth === 0 ? i : -1;
}

function matchColumnExpr(s: string, pos: number): number {
  let i = pos;
  // optional table qualifier: word. or "word".
  if (s[i] === '"') {
    const close = s.indexOf('"', i + 1);
    if (close === -1) return -1;
    i = close + 1;
    if (s[i] === ".") i++;
  } else {
    const m = s.slice(i).match(/^\w+\./);
    if (m) i += m[0].length;
  }
  // column name: word or "word", or function call: word(...)
  if (s[i] === '"') {
    const close = s.indexOf('"', i + 1);
    if (close === -1) return -1;
    return close + 1;
  }
  const nameMatch = s.slice(i).match(/^\w+/);
  if (!nameMatch) return -1;
  i += nameMatch[0].length;
  // function call with balanced parens
  if (s[i] === "(") {
    const end = skipBalancedParens(s, i);
    if (end === -1) return -1;
    return end;
  }
  return i;
}

function skipWhitespace(s: string, pos: number): number {
  while (pos < s.length && /\s/.test(s[pos])) pos++;
  return pos;
}

function matchColumnList(s: string, allowOrder: boolean): boolean {
  let i = skipWhitespace(s, 0);
  if (i >= s.length) return false;

  while (true) {
    const exprEnd = matchColumnExpr(s, i);
    if (exprEnd === -1) return false;
    i = skipWhitespace(s, exprEnd);

    // optional AS alias
    if (/^AS\b/i.test(s.slice(i))) {
      i = skipWhitespace(s, i + 2);
      if (s[i] === '"') {
        const close = s.indexOf('"', i + 1);
        if (close === -1) return false;
        i = skipWhitespace(s, close + 1);
      } else {
        const alias = s.slice(i).match(/^\w+/);
        if (!alias) return false;
        i = skipWhitespace(s, i + alias[0].length);
      }
    }

    if (allowOrder) {
      if (/^COLLATE\b/i.test(s.slice(i))) {
        i = skipWhitespace(s, i + 7);
        const coll = s.slice(i).match(/^(?:\w+|"\w+")/);
        if (!coll) return false;
        i = skipWhitespace(s, i + coll[0].length);
      }
      if (/^(?:ASC|DESC)\b/i.test(s.slice(i))) {
        i = skipWhitespace(s, i + s.slice(i).match(/^(?:ASC|DESC)/i)![0].length);
      }
      if (/^NULLS\s+(?:FIRST|LAST)\b/i.test(s.slice(i))) {
        const nm = s.slice(i).match(/^NULLS\s+(?:FIRST|LAST)/i)!;
        i = skipWhitespace(s, i + nm[0].length);
      }
    }

    if (i >= s.length) return true;
    if (s[i] !== ",") return false;
    i = skipWhitespace(s, i + 1);
  }
}

// Exposed as RegExp-like objects with .test() for API compat with Rails
export const COLUMN_NAME_MATCHER = { test: (s: string) => matchColumnList(s, false) };
export const COLUMN_NAME_WITH_ORDER_MATCHER = { test: (s: string) => matchColumnList(s, true) };

export function columnNameMatcher(): { test(s: string): boolean } {
  return COLUMN_NAME_MATCHER;
}

export function columnNameWithOrderMatcher(): { test(s: string): boolean } {
  return COLUMN_NAME_WITH_ORDER_MATCHER;
}
