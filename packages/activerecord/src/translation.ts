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
 * Return the ancestor chain for i18n lookup, stopping at the
 * ActiveRecord Base class (the first class whose parent prototype
 * does not have _attributeDefinitions, indicating it's Model, not Base).
 *
 * Mirrors: ActiveRecord::Translation#lookup_ancestors
 */
export function lookupAncestors(modelClass: typeof Base): Array<typeof Base> {
  const ancestors: Array<typeof Base> = [];
  let klass: any = modelClass;
  while (klass) {
    ancestors.push(klass);
    const parent = Object.getPrototypeOf(klass);
    if (!parent?.prototype || !("_attributeDefinitions" in parent)) break;
    klass = parent;
  }
  return ancestors;
}
