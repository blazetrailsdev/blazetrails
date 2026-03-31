import { Type, ValueType } from "@blazetrails/activemodel";

/**
 * A type map that uses exact string keys (hash lookup) rather than
 * regex matching. More efficient for known type names.
 *
 * Mirrors: ActiveRecord::Type::HashLookupTypeMap
 */
export class HashLookupTypeMap {
  private _mapping: Map<string, (lookupKey: string, ...args: unknown[]) => Type> = new Map();
  private _cache: Map<string, Map<string, Type>> = new Map();

  lookup(lookupKey: string, ...args: unknown[]): Type {
    return this.fetch(lookupKey, ...args, () => new ValueType());
  }

  fetch(lookupKey: string, ...rest: unknown[]): Type {
    let fallback: (() => Type) | undefined;
    let args: unknown[];

    // Last arg is the fallback if it's a function
    if (rest.length > 0 && typeof rest[rest.length - 1] === "function") {
      fallback = rest[rest.length - 1] as () => Type;
      args = rest.slice(0, -1);
    } else {
      args = rest;
    }
    const argsKey = args
      .map((a) => {
        if (a === undefined) return "\x00undef";
        if (a === null) return "\x00null";
        if (typeof a === "bigint") return `\x00bigint:${a}`;
        if (typeof a === "symbol") return `\x00symbol:${a.toString()}`;
        if (typeof a === "function") return `\x00fn:${a.name || "anon"}`;
        try {
          return JSON.stringify(a) ?? `\x00${typeof a}`;
        } catch {
          return `\x00obj:${String(a)}`;
        }
      })
      .join("\x01");

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

  registerType(
    key: string,
    value?: Type | ((lookupKey: string, ...args: unknown[]) => Type),
  ): void {
    if (value === undefined) throw new Error("registerType requires a value or block");
    if (typeof value === "function") {
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

  aliasType(type: string, targetType: string): void {
    this.registerType(type, (_lookupKey: unknown, ...args: unknown[]) =>
      this.lookup(targetType, ...args),
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
