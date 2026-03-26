/**
 * Delegation module — forwards Array-like methods from Relation
 * to the loaded records array.
 *
 * Mirrors: ActiveRecord::Delegation
 */
export class Delegation {
  static readonly ARRAY_DELEGATES = [
    "flat_map",
    "map",
    "select",
    "sort",
    "sort_by",
    "reject",
    "each",
    "each_cons",
    "each_with_object",
    "include?",
    "index",
  ] as const;
}

/**
 * Cache for class-specific relation methods. Each model class
 * gets its own Relation subclass with scopes, enum scopes, etc.
 *
 * Mirrors: ActiveRecord::Delegation::DelegateCache
 */
export class DelegateCache {
  private _cache: Map<string, any> = new Map();

  get(key: string): any {
    return this._cache.get(key);
  }

  set(key: string, value: any): void {
    this._cache.set(key, value);
  }
}

/**
 * Module mixed into model-specific Relation subclasses.
 *
 * Mirrors: ActiveRecord::Delegation::ClassSpecificRelation
 */
export class ClassSpecificRelation {}

/**
 * Dynamically generated relation methods (scopes) for a model class.
 *
 * Mirrors: ActiveRecord::Delegation::GeneratedRelationMethods
 */
export class GeneratedRelationMethods {}

/**
 * Class methods added to Relation for delegation support.
 *
 * Mirrors: ActiveRecord::Delegation::ClassMethods
 */
export class ClassMethods {}
