/**
 * Delegation — delegates scope and query method calls from model
 * classes to Relation instances via a Proxy.
 *
 * In Rails, model classes delegate methods like where/order/limit to
 * an implicit Relation via method_missing. In our codebase, the
 * wrapWithScopeProxy function creates a Proxy that intercepts property
 * access and delegates named scopes to the model's scope registry.
 *
 * Mirrors: ActiveRecord::Delegation
 */

import type { Base } from "../base.js";

/**
 * The Delegation module interface.
 *
 * Mirrors: ActiveRecord::Delegation
 */
export interface Delegation {
  delegatedClasses: Set<Function>;
}

/**
 * ClassSpecificRelation — a relation subclass tied to a specific model.
 * In Rails this is dynamically created per model class. In our codebase,
 * the Proxy handles this transparently.
 *
 * Mirrors: ActiveRecord::Delegation::ClassSpecificRelation
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClassSpecificRelation {}

/**
 * GeneratedRelationMethods — container for dynamically generated
 * relation methods (e.g., scopes that are compiled into methods).
 *
 * Mirrors: ActiveRecord::Delegation::GeneratedRelationMethods
 */
export class GeneratedRelationMethods {
  private _methods: Map<string, Function> = new Map();

  generate(name: string, fn: Function): void {
    this._methods.set(name, fn);
  }

  get(name: string): Function | undefined {
    return this._methods.get(name);
  }

  has(name: string): boolean {
    return this._methods.has(name);
  }
}

/**
 * DelegateCache — caches delegation lookups per model class so scope
 * resolution doesn't repeat the prototype chain walk on every call.
 *
 * Mirrors: ActiveRecord::Delegation::DelegateCache
 */
export class DelegateCache {
  private _cache: Map<Function, Set<string>> = new Map();

  initialize(modelClass: Function): void {
    if (!this._cache.has(modelClass)) {
      this._cache.set(modelClass, new Set());
    }
  }

  hasDelegated(modelClass: Function, method: string): boolean {
    return this._cache.get(modelClass)?.has(method) ?? false;
  }

  register(modelClass: Function, method: string): void {
    this.initialize(modelClass);
    this._cache.get(modelClass)!.add(method);
  }
}

/**
 * Wrap a Relation in a Proxy that delegates scope names
 * to the model's registered scopes.
 */
export function wrapWithScopeProxy<T extends Base>(rel: any): any {
  return new Proxy(rel, {
    get(target: any, prop: string | symbol, receiver: any) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === "symbol") return value;
      if (value !== undefined) return value;
      if (prop in target) return value;

      const modelClass = target._modelClass as typeof Base;
      if (modelClass._scopes.has(prop as string)) {
        return (...args: any[]) => {
          const scopeFn = modelClass._scopes.get(prop as string)!;
          const result = scopeFn(target, ...args);
          const extensions = modelClass._scopeExtensions?.get(prop as string);
          if (extensions && result && typeof result === "object") {
            for (const [name, fn] of Object.entries(extensions)) {
              (result as any)[name] = fn.bind(result);
            }
          }
          return result;
        };
      }
      return value;
    },
  });
}
