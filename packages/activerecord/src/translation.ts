import type { Base } from "./base.js";

/**
 * Translation and i18n support for ActiveRecord models.
 *
 * Mirrors: ActiveRecord::Translation
 */

/**
 * Return the i18n scope for this model class.
 *
 * Mirrors: ActiveRecord::Translation#i18n_scope
 */
export function i18nScope(_modelClass: typeof Base): string {
  return "activerecord";
}

/**
 * Return the ancestor chain for i18n lookup, stopping before Base.
 *
 * Mirrors: ActiveRecord::Translation#lookup_ancestors
 */
export function lookupAncestors(modelClass: typeof Base): Array<typeof Base> {
  const ancestors: Array<typeof Base> = [];
  let klass: typeof Base | null = modelClass;
  while (klass) {
    if (klass.name === "Base") break;
    ancestors.push(klass);
    const parent = Object.getPrototypeOf(klass);
    klass = parent?.prototype ? parent : null;
  }
  if (ancestors.length === 0) ancestors.push(modelClass);
  return ancestors;
}
