// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

/**
 * Serialization mixin contract — provides serializable_hash.
 *
 * Mirrors: ActiveModel::Serialization
 */
export interface Serialization {
  serializableHash(options?: SerializeOptions): Record<string, unknown>;
}

/**
 * Serialization options.
 */
export interface SerializeOptions {
  only?: string[];
  except?: string[];
  methods?: string[];
  include?: Record<string, SerializeOptions> | string[] | string;
}

/**
 * Serialize a model's attributes to a plain object.
 *
 * Mirrors: ActiveModel::Serialization#serializable_hash
 */
export function serializableHash(
  record: AnyRecord,
  options: SerializeOptions = {},
): Record<string, unknown> {
  // Get keys without materializing all values
  const attrStore = record._attributes;
  let keys: string[];
  if (attrStore && typeof attrStore.keys === "function" && !(attrStore instanceof Map)) {
    keys = attrStore.keys();
  } else if (attrStore instanceof Map) {
    keys = Array.from(attrStore.keys());
  } else if (record.attributes) {
    keys = Object.keys(record.attributes);
  } else {
    keys = [];
  }

  // Exclude virtual attributes (e.g., acceptance/confirmation) from serialization
  const defs = record.constructor?._attributeDefinitions as
    | Map<string, { virtual?: boolean }>
    | undefined;
  if (defs) {
    keys = keys.filter((k) => !defs.get(k)?.virtual);
  }

  if (options.only) {
    keys = keys.filter((k) => options.only!.includes(k));
  } else if (options.except) {
    keys = keys.filter((k) => !options.except!.includes(k));
  }

  // Read values only for filtered keys
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (attrStore && typeof attrStore.fetchValue === "function") {
      result[key] = attrStore.fetchValue(key);
    } else if (attrStore instanceof Map) {
      result[key] = attrStore.get(key);
    } else if (record.readAttribute) {
      result[key] = record.readAttribute(key);
    } else {
      result[key] = record.attributes?.[key];
    }
  }

  if (options.methods) {
    for (const method of options.methods) {
      if (typeof record[method] === "function") {
        result[method] = record[method]();
      } else if (method in record) {
        result[method] = record[method];
      } else {
        throw new Error(
          `undefined method '${method}' for an instance of ${record.constructor.name}`,
        );
      }
    }
  }

  // Handle include option for nested associations
  if (options.include) {
    const includes = normalizeIncludes(options.include);
    for (const [assocName, assocOpts] of Object.entries(includes)) {
      // Check for cached/preloaded associations
      const cached =
        record._preloadedAssociations?.get(assocName) ?? record._cachedAssociations?.get(assocName);
      if (cached !== undefined) {
        if (Array.isArray(cached)) {
          result[assocName] = cached.map((r: AnyRecord) => serializableHash(r, assocOpts));
        } else if (cached && typeof cached === "object" && cached._attributes) {
          result[assocName] = serializableHash(cached, assocOpts);
        } else {
          result[assocName] = cached;
        }
      }
    }
  }

  return result;
}

/**
 * Coerce a value into a JSON-safe shape, mirroring Rails'
 * `ActiveSupport::JSON.encode` → `Object#as_json` dispatch.
 *
 * Native `JSON.stringify` handles most primitives + Date
 * (`Date.prototype.toJSON()` → ISO 8601), but throws on `BigInt` and
 * emits nothing useful for non-enumerable types. Rails' encoder:
 *
 * - BigDecimal → string (to preserve precision)
 * - Time / Date / DateTime → ISO 8601 string
 * - Symbol → string (Ruby symbols are interned strings)
 *
 * We cover the JS analog:
 * - `bigint` → string (JSON.stringify throws otherwise)
 * - `Date` → ISO 8601 string, or `null` for invalid dates (matches
 *   `Date.prototype.toJSON`)
 * - Plain arrays / objects → recurse
 * - Anything with its own `asJson()` or `toJSON()` → call it and recurse
 *   (matches Rails' `respond_to?(:as_json)` protocol)
 * - Everything else → pass through (numbers, strings, booleans, null)
 *
 * Note on JS Symbols: we intentionally do NOT coerce. Ruby symbols
 * are interned-string identifiers (Rails' `:active ≈ "active"`). JS
 * `Symbol()` is a unique identity sigil — different concept. Coercing
 * would misrepresent it. `JSON.stringify` already drops symbol-valued
 * properties per spec, which correctly signals "this doesn't
 * serialize".
 */
export function coerceForJson(
  value: unknown,
  seen: WeakMap<object, unknown> = new WeakMap(),
  inProgress: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  // Note: no JS `Symbol` handling. Ruby symbols are interned-string
  // identifiers (`:active` ≈ "active"), which is why Rails
  // `Symbol#as_json` returns the name. JS `Symbol()` is a unique
  // identity sigil (well-known symbols, private keys) — coercing to
  // its description would misrepresent its role. Leave symbols alone;
  // `JSON.stringify` already drops them per spec, which correctly
  // signals "this doesn't serialize".
  if (value instanceof Date) {
    // Invalid Date (e.g. `new Date("bad")`) throws on `toISOString`.
    // `Date.prototype.toJSON` returns null in that case — match it so
    // `asJson` stays JSON-safe regardless of attribute hygiene.
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (Array.isArray(value)) {
    // True cycle: short-circuit to null (Rails' JSON encoder raises, but
    // `null` is less hostile for accidental self-refs and JSON.stringify
    // would also fail).
    if (inProgress.has(value)) return null;
    // Previously coerced: return the same coerced result so shared
    // references preserve object identity in the output (avoids silent
    // data loss on `{ a: obj, b: obj }`-shaped hashes).
    if (seen.has(value)) return seen.get(value);
    const out: unknown[] = [];
    seen.set(value, out);
    inProgress.add(value);
    try {
      for (const entry of value) {
        out.push(coerceForJson(entry, seen, inProgress));
      }
    } finally {
      inProgress.delete(value);
    }
    return out;
  }
  if (typeof value === "object") {
    if (inProgress.has(value)) return null;
    if (seen.has(value)) return seen.get(value);
    const v = value as Record<string, unknown> & {
      asJson?: () => unknown;
      toJSON?: () => unknown;
    };
    // `asJson` / `toJSON` delegation: enter the same in-progress/seen
    // bookkeeping so the dispatched value still contributes to cycle
    // detection and shared-ref memoization.
    if (typeof v.asJson === "function") {
      inProgress.add(value);
      try {
        const out = coerceForJson(v.asJson(), seen, inProgress);
        seen.set(value, out);
        return out;
      } finally {
        inProgress.delete(value);
      }
    }
    if (typeof v.toJSON === "function") {
      inProgress.add(value);
      try {
        const out = coerceForJson(v.toJSON(), seen, inProgress);
        seen.set(value, out);
        return out;
      } finally {
        inProgress.delete(value);
      }
    }
    const out: Record<string, unknown> = {};
    seen.set(value, out);
    inProgress.add(value);
    try {
      for (const [k, val] of Object.entries(v)) {
        out[k] = coerceForJson(val, seen, inProgress);
      }
    } finally {
      inProgress.delete(value);
    }
    return out;
  }
  return value;
}

function normalizeIncludes(
  include: Record<string, SerializeOptions> | string[] | string,
): Record<string, SerializeOptions> {
  if (typeof include === "string") {
    return { [include]: {} };
  }
  if (Array.isArray(include)) {
    const result: Record<string, SerializeOptions> = {};
    for (const name of include) {
      result[name] = {};
    }
    return result;
  }
  return include;
}
