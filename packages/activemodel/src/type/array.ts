import { Type } from "./value.js";
import { StringType } from "./string.js";

/**
 * Wraps a subtype to represent a PostgreSQL array column (e.g. TEXT[], INTEGER[]).
 * Mirrors ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Array.
 */
export class ArrayType extends Type<unknown[]> {
  readonly name = "array";
  readonly subtype: Type;

  constructor(subtype?: Type) {
    super();
    this.subtype = subtype ?? new StringType();
  }

  cast(value: unknown): unknown[] | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      return value.map((v) => this.subtype.cast(v));
    }
    if (typeof value === "string") {
      return this.parseArrayLiteral(value);
    }
    return [this.subtype.cast(value)];
  }

  serialize(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) return value;
    return value.map((v) => this.subtype.serialize(v));
  }

  private parseArrayLiteral(str: string): unknown[] {
    const trimmed = str.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return [this.subtype.cast(str)];
    }
    const inner = trimmed.slice(1, -1);
    if (inner.length === 0) return [];

    const results: unknown[] = [];
    let current = "";
    let inQuote = false;
    let depth = 0;

    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (inQuote) {
        if (ch === "\\") {
          current += inner[++i];
        } else if (ch === '"') {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === "{") {
        depth++;
        current += ch;
      } else if (ch === "}") {
        depth--;
        current += ch;
      } else if (ch === "," && depth === 0) {
        results.push(this.castElement(current));
        current = "";
      } else if (ch === '"') {
        inQuote = true;
      } else {
        current += ch;
      }
    }
    results.push(this.castElement(current));
    return results;
  }

  private castElement(raw: string): unknown {
    if (raw === "NULL") return null;
    if (raw.startsWith("{")) {
      const sub = new ArrayType(this.subtype);
      return sub.parseArrayLiteral(raw);
    }
    return this.subtype.cast(raw);
  }
}
