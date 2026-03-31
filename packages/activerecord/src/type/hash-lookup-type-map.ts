import { Type, ValueType } from "@blazetrails/activemodel";

/**
 * A type map that uses exact string keys (hash lookup) rather than
 * regex matching. More efficient for known type names.
 *
 * Mirrors: ActiveRecord::Type::HashLookupTypeMap
 */
export class HashLookupTypeMap {
  private _mapping: Map<string, (...args: unknown[]) => Type> = new Map();
  private _cache: Map<string, Map<string, Type>> = new Map();

  lookup(lookupKey: string, ...args: unknown[]): Type {
    return this.fetch(lookupKey, ...args, () => new ValueType());
  }

  fetch(lookupKey: string, ...rest: unknown[]): Type {
    const fallback =
      typeof rest[rest.length - 1] === "function" ? (rest.pop() as () => Type) : undefined;
    const args = rest;
    const argsKey = JSON.stringify(args);

    let keyCache = this._cache.get(lookupKey);
    if (!keyCache) {
      keyCache = new Map();
      this._cache.set(lookupKey, keyCache);
    }

    const cached = keyCache.get(argsKey);
    if (cached) return cached;

    const result = this._performFetch(lookupKey, args, fallback);
    keyCache.set(argsKey, result);
    return result;
  }

  registerType(key: string, value?: Type | ((...args: unknown[]) => Type)): void {
    if (value === undefined) throw new Error("registerType requires a value or block");
    if (typeof value === "function" && !(value instanceof ValueType)) {
      this._mapping.set(key, value as (...args: unknown[]) => Type);
    } else {
      this._mapping.set(key, () => value as Type);
    }
    this._cache.clear();
  }

  clear(): void {
    this._mapping.clear();
    this._cache.clear();
  }

  aliasType(type: string, aliasType: string): void {
    this.registerType(type, (_lookupKey: unknown, ...args: unknown[]) =>
      this.lookup(aliasType, ...args),
    );
  }

  has(key: string): boolean {
    return this._mapping.has(key);
  }

  keys(): string[] {
    return [...this._mapping.keys()];
  }

  private _performFetch(type: string, args: unknown[], fallback?: () => Type): Type {
    const factory = this._mapping.get(type);
    if (factory) return factory(type, ...args);
    if (fallback) return fallback();
    return new ValueType();
  }
}
