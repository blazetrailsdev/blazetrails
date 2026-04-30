import { Temporal } from "@blazetrails/activesupport/temporal";

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
 * (serialization.rb:111-138)
 */
export function serializableHash(
  record: AnyRecord,
  options: SerializeOptions = {},
): Record<string, unknown> {
  // Prefer an instance-level override (Rails' Model.override semantics)
  // over the standalone helper. When the host class is a JSON / Serialization
  // mixin host, its delegator method just bounces back to the function below,
  // so falling through is safe.
  const instanceAttrNames = (record as { attributeNamesForSerialization?: () => string[] })
    .attributeNamesForSerialization;
  let keys =
    typeof instanceAttrNames === "function"
      ? instanceAttrNames.call(record)
      : attributeNamesForSerialization(record);

  if (options.only) {
    keys = keys.filter((k) => options.only!.includes(k));
  } else if (options.except) {
    keys = keys.filter((k) => !options.except!.includes(k));
  }

  const result = serializableAttributes(record, keys);

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

  serializableAddIncludes(record, options, (assocName, records, opts) => {
    if (Array.isArray(records)) {
      result[assocName] = records.map((r: AnyRecord) => serializableHash(r, opts));
    } else if (records && typeof records === "object" && (records as AnyRecord)._attributes) {
      result[assocName] = serializableHash(records, opts);
    } else {
      result[assocName] = records;
    }
  });

  return result;
}

/**
 * Mirrors: ActiveModel::Serialization#attribute_names_for_serialization
 * (serialization.rb:158-160)
 *
 *   def attribute_names_for_serialization
 *     attributes.keys
 *   end
 *
 * Models can override this hook to scope which attributes appear.
 * Trails has multiple attribute storage shapes (AttributeSet via
 * `_attributes`, Map, plain object) so the fallback walks them in
 * order. Virtual attributes (acceptance/confirmation) are filtered
 * out — they aren't real attributes and shouldn't surface in JSON.
 *
 * @internal Rails-private helper.
 */
export function attributeNamesForSerialization(record: AnyRecord): string[] {
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

  const defs = record.constructor?._attributeDefinitions as
    | Map<string, { virtual?: boolean }>
    | undefined;
  if (defs) {
    keys = keys.filter((k) => !defs.get(k)?.virtual);
  }
  return keys;
}

/**
 * Mirrors: ActiveModel::Serialization#serializable_attributes
 * (serialization.rb:162-164)
 *
 *   def serializable_attributes(attribute_names)
 *     attribute_names.index_with { |n| read_attribute_for_serialization(n) }
 *   end
 *
 * Builds a `{ name → value }` hash by reading each attribute via the
 * attribute store fall-through (AttributeSet → Map → readAttribute →
 * plain attributes). The Rails analogue dispatches through
 * `read_attribute_for_serialization` (aliased to `send` by default).
 *
 * @internal Rails-private helper.
 */
export function serializableAttributes(
  record: AnyRecord,
  attributeNames: readonly string[],
): Record<string, unknown> {
  const attrStore = record._attributes;
  const result: Record<string, unknown> = {};
  for (const key of attributeNames) {
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
  return result;
}

/**
 * Mirrors: ActiveModel::Serialization#serializable_add_includes
 * (serialization.rb:171-183)
 *
 *   def serializable_add_includes(options = {})
 *     return unless includes = options[:include]
 *     unless includes.is_a?(Hash)
 *       includes = Hash[Array(includes).flat_map { |n| n.is_a?(Hash) ? n.to_a : [[n, {}]] }]
 *     end
 *     includes.each do |association, opts|
 *       if records = send(association)
 *         yield association, records, opts
 *       end
 *     end
 *   end
 *
 * The trails port resolves associations against the model's preload /
 * association cache rather than `send`, since trails uses explicit
 * cache slots instead of Ruby's method-missing-driven association
 * accessors. The yield contract is identical: `(association, records,
 * opts)` per included entry.
 *
 * @internal Rails-private helper.
 */
export function serializableAddIncludes(
  record: AnyRecord,
  options: SerializeOptions,
  callback: (association: string, records: unknown, opts: SerializeOptions) => void,
): void {
  if (!options.include) return;
  const includes = normalizeIncludes(options.include);
  for (const [assocName, assocOpts] of Object.entries(includes)) {
    const cached =
      record._preloadedAssociations?.get(assocName) ?? record._cachedAssociations?.get(assocName);
    if (cached !== undefined) {
      callback(assocName, cached, assocOpts);
    }
  }
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
 * - `bigint` → decimal string. Rails serializes large integers as JSON
 *   numbers because Ruby's Integer is arbitrary-precision and the JSON
 *   encoder handles them natively. JS `JSON.stringify` throws on bigint,
 *   and JS numbers lose precision above 2^53-1, so we emit a decimal
 *   string instead. Consumers that need the numeric value must parse
 *   with `BigInt(str)`.
 * - Temporal types → ISO 8601 string via `toJSON()`. Precision is
 *   native (no trailing-zero truncation for JSON consumers).
 * - Plain arrays / objects → recurse
 * - Everything else → pass through (numbers, strings, booleans, null)
 *
 * Does NOT delegate to nested `asJson()` / `toJSON()` methods. Rails'
 * `Object#as_json` dispatch is recursive from a single encoder, so
 * cycle tracking threads through every call. In our JS port
 * `Model#asJson` starts a fresh coerceForJson with new cycle state,
 * so re-entering through a Model's `asJson` would reset the guards
 * and stack-overflow on model-model cycles. Instead, Model instances
 * reach coerceForJson already pre-flattened by `serializableHash`
 * (via its include path at serialization.ts:88-104 for associations
 * and via the usual attribute read for scalars), so no delegation is
 * needed.
 *
 * Note on JS Symbols: we intentionally do NOT coerce. Ruby symbols
 * are interned-string identifiers (Rails' `:active ≈ "active"`). JS
 * `Symbol()` is a unique identity sigil — different concept. Coercing
 * would misrepresent it. `JSON.stringify` already drops symbol-valued
 * properties per spec, which correctly signals "this doesn't
 * serialize".
 */
export function coerceForJson(value: unknown): unknown {
  return _coerceForJson(value, new WeakMap(), new WeakSet());
}

/**
 * Internal recursion for `coerceForJson`. Threaded with shared cycle
 * state (`seen` for memoization, `inProgress` for self-recursion
 * detection) so the top-level entry point can keep a narrow public
 * signature.
 */
function _coerceForJson(
  value: unknown,
  seen: WeakMap<object, unknown>,
  inProgress: WeakSet<object>,
): unknown {
  // `null` is valid JSON. `undefined` is not — `JSON.stringify` silently
  // drops object properties whose value is `undefined`, so an attribute
  // that happens to be unset would just disappear from the output
  // instead of appearing as `null` (matches Ruby `nil` mapping to JSON
  // `null`). Normalize both to `null` at the top of the recursion.
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  // Note: no JS `Symbol` handling. Ruby symbols are interned-string
  // identifiers (`:active` ≈ "active"), which is why Rails
  // `Symbol#as_json` returns the name. JS `Symbol()` is a unique
  // identity sigil (well-known symbols, private keys) — coercing to
  // its description would misrepresent its role. Leave symbols alone;
  // `JSON.stringify` already drops them per spec, which correctly
  // signals "this doesn't serialize".
  // boundary: defensive ISO 8601 emission for any Date attribute value supplied
  // by a custom (non-Temporal-cast) type. Invalid Dates coerce to null like
  // Date#toJSON does, keeping asJson safe for downstream JSON.stringify.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (
    value instanceof Temporal.Instant ||
    value instanceof Temporal.PlainDateTime ||
    value instanceof Temporal.PlainDate ||
    value instanceof Temporal.PlainTime ||
    value instanceof Temporal.ZonedDateTime
  ) {
    // Temporal.prototype.toJSON() emits ISO 8601 with native precision.
    return value.toJSON();
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
        out.push(_coerceForJson(entry, seen, inProgress));
      }
    } finally {
      inProgress.delete(value);
    }
    return out;
  }
  if (typeof value === "object") {
    // Only recurse into plain objects (no prototype, or
    // `Object.prototype` directly). Class instances keep an opaque
    // pass-through so their internals don't leak — e.g. a `Model`
    // reached here as a raw attribute value would expose
    // `_attributes`/`_dirty`/`errors` via `Object.entries`. For these,
    // JSON.stringify will invoke the instance's own `toJSON()` at
    // encode time, which is the right Rails-parity boundary.
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) return value;

    if (inProgress.has(value)) return null;
    if (seen.has(value)) return seen.get(value);
    const v = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    seen.set(value, out);
    inProgress.add(value);
    try {
      for (const [k, val] of Object.entries(v)) {
        // Use defineProperty so an own `__proto__` key (common on
        // JSON.parse output) is written as a data property rather than
        // invoking `Object.prototype.__proto__`'s setter and polluting
        // the output's prototype.
        Object.defineProperty(out, k, {
          value: _coerceForJson(val, seen, inProgress),
          writable: true,
          enumerable: true,
          configurable: true,
        });
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
