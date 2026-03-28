/**
 * Delegation — delegates Array-like methods from model classes to Relation.
 *
 * In Rails, model classes delegate methods like where/order/limit to
 * an implicit Relation via method_missing. In our codebase, Base creates
 * a Relation and delegates query methods to it.
 *
 * Mirrors: ActiveRecord::Delegation
 */

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
 *
 * Mirrors: ActiveRecord::Delegation::ClassSpecificRelation
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClassSpecificRelation {}

/**
 * GeneratedRelationMethods — dynamically generated relation methods.
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
}

/**
 * DelegateCache — caches delegated methods per model class.
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
