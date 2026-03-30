/**
 * Mirrors: ActiveRecord::Type::HashLookupTypeMap
 */
import { Type, ValueType } from "@blazetrails/activemodel";

export class HashLookupTypeMap {
  private _mapping: Map<string, (...args: unknown[]) => Type> = new Map();
  private _cache: Map<string, Map<string, Type>> = new Map();

  lookup(lookupKey: string, ...args: unknown[]): Type {
    return this.fetch(lookupKey, ...args, () => new ValueType());
  }

  fetch(lookupKey: string, ...rest: unknown[]): Type {
    const args = rest.filter((a) => typeof a !== "function");
    const fallback =
      typeof rest[rest.length - 1] === "function"
        ? (rest[rest.length - 1] as () => Type)
        : undefined;

    const cacheKey = JSON.stringify(args);
    let subCache = this._cache.get(lookupKey);
    if (!subCache) {
      subCache = new Map();
      this._cache.set(lookupKey, subCache);
    }
    const cached = subCache.get(cacheKey);
    if (cached) return cached;

    const result = this._performFetch(lookupKey, args, fallback);
    subCache.set(cacheKey, result);
    return result;
  }

  registerType(key: string, value?: Type, block?: (...args: unknown[]) => Type): void {
    if (!value && !block) throw new Error("registerType requires a value or block");
    if (block) {
      this._mapping.set(key, block);
    } else {
      this._mapping.set(key, () => value!);
    }
    this._cache.clear();
  }

  clear(): void {
    this._mapping.clear();
    this._cache.clear();
  }

  aliasType(type: string, aliasType: string): void {
    this.registerType(type, undefined, (_type: unknown, ...args: unknown[]) =>
      this.lookup(aliasType, ...args),
    );
  }

  hasKey(key: string): boolean {
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
