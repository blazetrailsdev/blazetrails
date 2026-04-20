import type { Base } from "../base.js";
import type { Relation } from "../relation.js";

/**
 * Default scope handling — applies default_scope to all queries
 * and provides unscoped to bypass it.
 *
 * Mirrors: ActiveRecord::Scoping::Default
 */
export class Default {
  static buildDefaultScope(modelClass: any, buildRelation: () => any): any {
    let rel = buildRelation();
    const defaultScopeFn = modelClass._defaultScope;
    if (defaultScopeFn) {
      rel = defaultScopeFn(rel);
    }
    return rel;
  }

  static unscoped(modelClass: any, buildRelation: () => any): any {
    return buildRelation();
  }
}

/**
 * Manages evaluating and applying default scopes.
 *
 * Mirrors: ActiveRecord::Scoping::Default::DefaultScope
 */
export class DefaultScope {
  readonly modelClass: any;
  readonly allQueries: boolean;

  constructor(modelClass: any, allQueries = false) {
    this.modelClass = modelClass;
    this.allQueries = allQueries;
  }

  get scope(): ((rel: any) => any) | null {
    return this.modelClass._defaultScope ?? null;
  }
}

/**
 * Define a default scope applied to all queries for this model.
 *
 * Mirrors: ActiveRecord::Scoping::Default::ClassMethods#default_scope
 */
export function defaultScope<T extends typeof Base>(
  this: T,
  fn: (rel: Relation<InstanceType<T>>) => Relation<any>,
): void {
  (this as unknown as { _defaultScope: ((rel: any) => any) | null })._defaultScope = fn as (
    rel: any,
  ) => any;
}

/**
 * Return a relation that bypasses the default scope.
 *
 * Mirrors: ActiveRecord::Scoping::Default::ClassMethods#unscoped
 */
export function unscoped<T extends typeof Base>(this: T): Relation<InstanceType<T>> {
  return Default.unscoped(this, () => (this as unknown as typeof Base)._buildUnscopedRelation());
}

/**
 * Mirrors: ActiveRecord::Scoping::Default::ClassMethods#default_scopes?
 */
export function isDefaultScopes(
  this: { defaultScopes?: DefaultScope[] },
  options?: { allQueries?: boolean },
): boolean {
  const scopes = this.defaultScopes ?? [];
  if (options?.allQueries) {
    return scopes.some((s) => s.allQueries);
  }
  return scopes.length > 0;
}
