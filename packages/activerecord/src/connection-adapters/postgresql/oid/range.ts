/**
 * PostgreSQL range type and range value.
 *
 * With primitive bounds, this remains the query value object used by
 * PredicateBuilder. With a subtype as the first argument, it behaves like
 * Rails' PostgreSQL::OID::Range type.
 */
export class Range {
  readonly begin: unknown;
  readonly end: unknown;
  readonly excludeEnd: boolean;
  readonly subtype: RangeSubtype | null;
  readonly type: string;

  constructor(begin: unknown, end?: unknown, excludeEnd: boolean = false) {
    if (isRangeSubtype(begin) && typeof end === "string") {
      this.subtype = begin;
      this.type = end;
      this.begin = null;
      this.end = null;
      this.excludeEnd = false;
      return;
    }

    this.begin = begin;
    this.end = end;
    this.excludeEnd = excludeEnd;
    this.subtype = null;
    this.type = "range";
  }

  typeCastForSchema(value: unknown): string {
    return String(value).replace(/Infinity/g, "::Float::INFINITY");
  }

  castValue(value: unknown): unknown {
    if (value == null || value === "empty" || value === "") return null;
    if (value instanceof Range && !value.subtype) return value;
    if (typeof value !== "string") return value;

    const extracted = this.extractBounds(value);
    const from = this.typeCastSingle(extracted.from);
    const to = this.typeCastSingle(extracted.to);

    if (!isInfinity(from) && extracted.excludeStart) {
      throw new Error(
        `The Ruby Range object does not support excluding the beginning of a Range. (unsupported value: '${value}')`,
      );
    }

    const [begin, end] = sanitizeBounds(from, to);
    return new Range(begin, end, extracted.excludeEnd);
  }

  cast(value: unknown): unknown {
    return this.castValue(value);
  }

  deserialize(value: unknown): unknown {
    return this.castValue(value);
  }

  serialize(value: unknown): unknown {
    if (!(value instanceof Range)) return value;
    if (value.subtype) return value;
    return new Range(
      this.typeCastSingleForDatabase(value.begin),
      this.typeCastSingleForDatabase(value.end),
      value.excludeEnd,
    );
  }

  map(value: Range, block: (value: unknown) => unknown): Range {
    return new Range(block(value.begin), block(value.end), value.excludeEnd);
  }

  isForceEquality(value: unknown): boolean {
    return value instanceof Range;
  }

  private typeCastSingle(value: unknown): unknown {
    if (isInfinity(value)) return value;
    return this.subtype?.deserialize?.(value) ?? this.subtype?.cast(value) ?? value;
  }

  private typeCastSingleForDatabase(value: unknown): unknown {
    if (isInfinity(value)) return value;
    const casted = this.subtype?.cast(value) ?? value;
    return this.subtype?.serialize(casted) ?? casted;
  }

  private extractBounds(value: string): {
    from: unknown;
    to: unknown;
    excludeStart: boolean;
    excludeEnd: boolean;
  } {
    const fromTo = value.slice(1, -1);
    const separator = findSeparator(fromTo);
    const from = fromTo.slice(0, separator);
    const to = fromTo.slice(separator + 1);

    return {
      from: from === "" || from === "-infinity" ? this.infinity({ negative: true }) : unquote(from),
      to: to === "" || to === "infinity" ? this.infinity() : unquote(to),
      excludeStart: value.startsWith("("),
      excludeEnd: value.endsWith(")"),
    };
  }

  private infinity(options?: { negative?: boolean }): unknown {
    return this.subtype?.infinity?.(options) ?? (options?.negative ? -Infinity : Infinity);
  }
}

export interface RangeSubtype {
  cast(value: unknown): unknown;
  serialize(value: unknown): unknown;
  deserialize?(value: unknown): unknown;
  infinity?(options?: { negative?: boolean }): unknown;
}

function isRangeSubtype(value: unknown): value is RangeSubtype {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { cast?: unknown }).cast === "function" &&
    typeof (value as { serialize?: unknown }).serialize === "function"
  );
}

function findSeparator(value: string): number {
  let inQuotes = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') {
      if (inQuotes && value[i + 1] === '"') {
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      return i;
    }
  }
  return value.length;
}

function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"').replace(/\\\\/g, "\\");
  }
  return value;
}

function sanitizeBounds(from: unknown, to: unknown): [unknown, unknown] {
  return [
    from === -Infinity && !infiniteFloatRangeCovers(to) ? null : from,
    to === Infinity && !infiniteFloatRangeCovers(from) ? null : to,
  ];
}

function isInfinity(value: unknown): boolean {
  return value === Infinity || value === -Infinity;
}

function infiniteFloatRangeCovers(value: unknown): boolean {
  return typeof value === "number" && !Number.isNaN(value);
}
