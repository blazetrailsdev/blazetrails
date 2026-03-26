/**
 * Formats a JS array as a PostgreSQL array literal string (without outer single quotes).
 * e.g. ["a", "b"] => {"a","b"}
 *
 * Shared between the Arel PostgreSQL visitor and ActiveRecord's inline SQL quoting.
 */
export function quoteArrayLiteral(arr: unknown[]): string {
  const elements = arr.map((v) => {
    if (v === null || v === undefined) return "NULL";
    if (Array.isArray(v)) return quoteArrayLiteral(v);
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `"${y}-${m}-${d}"`;
    }
    if (
      typeof v === "object" &&
      v !== null &&
      "toISOString" in v &&
      typeof (v as { toISOString: unknown }).toISOString === "function"
    ) {
      return `"${(v as { toISOString: () => string }).toISOString()}"`;
    }
    const str = String(v);
    const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  });
  return `{${elements.join(",")}}`;
}
