import type { Base } from "./base.js";

/**
 * Tracks stored attributes per model class.
 * Maps model class -> { storeName -> accessor keys[] }
 */
const _storedAttributes = new WeakMap<typeof Base, Record<string, string[]>>();

/**
 * Returns the stored attributes registry for a model class.
 */
export function storedAttributes(modelClass: typeof Base): Record<string, string[]> {
  return _storedAttributes.get(modelClass) ?? {};
}

/**
 * Reads/writes hash keys on a store attribute.
 *
 * Mirrors: ActiveRecord::Store::HashAccessor
 */
export class HashAccessor {
  static read(object: Base, attribute: string, key: string): unknown {
    HashAccessor.prepare(object, attribute);
    const data = object.readAttribute(attribute);
    if (data === null || data === undefined) return null;
    const obj = HashAccessor._toHash(data);
    return obj[key] ?? null;
  }

  static write(object: Base, attribute: string, key: string, value: unknown): void {
    HashAccessor.prepare(object, attribute);
    const current = HashAccessor.read(object, attribute, key);
    if (value !== current) {
      const raw = object.readAttribute(attribute);
      const obj = HashAccessor._toHash(raw);
      obj[key] = value;
      // Serialize back to JSON string for string columns, keep as object for json columns
      const isStringColumn = typeof raw === "string" || raw === null || raw === undefined;
      object.writeAttribute(attribute, isStringColumn ? JSON.stringify(obj) : obj);
    }
  }

  static prepare(object: Base, attribute: string): void {
    // Don't overwrite existing values — just ensure non-null
    const val = object.readAttribute(attribute);
    if (val === null || val === undefined) {
      object.writeAttribute(attribute, "{}");
    }
  }

  protected static _toHash(data: unknown): Record<string, unknown> {
    if (data === null || data === undefined) return {};
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch {
        return {};
      }
    }
    if (typeof data === "object" && !Array.isArray(data)) {
      return { ...(data as Record<string, unknown>) };
    }
    return {};
  }
}

/**
 * HashAccessor that coerces keys to strings.
 *
 * Mirrors: ActiveRecord::Store::StringKeyedHashAccessor
 */
export class StringKeyedHashAccessor extends HashAccessor {
  static override read(object: Base, attribute: string, key: string): unknown {
    return HashAccessor.read(object, attribute, String(key));
  }

  static override write(object: Base, attribute: string, key: string, value: unknown): void {
    HashAccessor.write(object, attribute, String(key), value);
  }
}

/**
 * HashAccessor that ensures the store value is an indifferent-access hash
 * (plain object with string keys, accessible by string or symbol).
 *
 * Mirrors: ActiveRecord::Store::IndifferentHashAccessor
 */
export class IndifferentHashAccessor extends HashAccessor {
  static override prepare(object: Base, attribute: string): void {
    const value = object.readAttribute(attribute);
    if (value === null || value === undefined) {
      object.writeAttribute(attribute, {});
    } else if (typeof value === "string") {
      try {
        object.writeAttribute(attribute, JSON.parse(value));
      } catch {
        object.writeAttribute(attribute, {});
      }
    }
  }
}

/**
 * Coder that wraps serialized store data, ensuring values are loaded
 * as plain objects with string keys (indifferent access).
 *
 * Mirrors: ActiveRecord::Store::IndifferentCoder
 */
export class IndifferentCoder {
  private _coder: { dump(obj: unknown): string; load(raw: unknown): unknown };

  constructor(
    _attrName: string,
    coder?: { dump(obj: unknown): string; load(raw: unknown): unknown },
  ) {
    this._coder = coder ?? {
      dump(obj: unknown): string {
        return JSON.stringify(obj);
      },
      load(raw: unknown): unknown {
        if (raw === null || raw === undefined) return {};
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        }
        return raw;
      },
    };
  }

  dump(obj: unknown): string {
    const hash = obj !== null && obj !== undefined && typeof obj === "object" ? { ...obj } : {};
    return this._coder.dump(hash);
  }

  load(raw: unknown): Record<string, unknown> {
    const loaded = this._coder.load(raw ?? "");
    return IndifferentCoder.asIndifferentHash(loaded);
  }

  static asIndifferentHash(obj: unknown): Record<string, unknown> {
    if (obj !== null && obj !== undefined && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
    return {};
  }
}

/**
 * Store — JSON-backed attribute accessors.
 *
 * Mirrors: ActiveRecord::Store
 *
 * Stores a hash in a single database column (as JSON), but exposes
 * individual keys as virtual attribute accessors.
 *
 * Usage:
 *   store(User, 'settings', { accessors: ['theme', 'language'] })
 *   store(User, 'settings', { accessors: ['theme'], prefix: true })
 *   store(User, 'settings', { accessors: ['theme'], prefix: 'config' })
 *   store(User, 'settings', { accessors: ['theme'], suffix: true })
 *   store(User, 'settings', { accessors: ['theme'], suffix: 'setting' })
 *
 * The column should use the "json" type or a serialized text column.
 */
export function store(
  modelClass: typeof Base,
  attribute: string,
  options: {
    accessors: string[];
    prefix?: boolean | string;
    suffix?: boolean | string;
  },
): void {
  const { accessors, prefix, suffix } = options;

  // Track stored attributes
  const existing = _storedAttributes.get(modelClass) ?? {};
  const prev = existing[attribute] ?? [];
  existing[attribute] = [...prev, ...accessors];
  _storedAttributes.set(modelClass, existing);

  for (const accessor of accessors) {
    let accessorName = accessor;
    if (prefix) {
      const pre = prefix === true ? attribute : String(prefix);
      accessorName = `${pre}_${accessorName}`;
    }
    if (suffix) {
      const suf = suffix === true ? attribute : String(suffix);
      accessorName = `${accessorName}_${suf}`;
    }

    Object.defineProperty(modelClass.prototype, accessorName, {
      get: function (this: Base) {
        return IndifferentHashAccessor.read(this, attribute, accessor);
      },
      set: function (this: Base, value: unknown) {
        IndifferentHashAccessor.write(this, attribute, accessor, value);
      },
      configurable: true,
    });
  }
}

/**
 * Standalone store_accessor for adding accessors to an existing store column.
 *
 * Mirrors: ActiveRecord::Store.store_accessor
 */
export const storeAccessor = store;
