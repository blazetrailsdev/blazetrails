import type { Base } from "./base.js";
import { reload as persistenceReload } from "./persistence.js";

/**
 * Aggregation cache lifecycle hooks mixed into every model.
 *
 * Rails memoizes composed-of value objects in an `@aggregation_cache` hash.
 * Our implementation computes value objects on the fly (no cache), so the
 * cache management methods are no-ops — but the API surface must be present.
 *
 * Mirrors: ActiveRecord::Aggregations
 */

/**
 * Dup the aggregation cache when the record is duped.
 * No-op: our composed-of computes on the fly with no cache.
 *
 * Mirrors: ActiveRecord::Aggregations#initialize_dup
 */
export function initializeDup(this: Base, _other: unknown): void {
  // Our composed-of accessors are computed on demand — nothing to dup.
}

/**
 * Clear the aggregation cache before reloading from the database.
 * No-op cache clear since we have no cache; delegates to persistence reload.
 *
 * Mirrors: ActiveRecord::Aggregations#reload
 */
export async function reload(this: Base): Promise<Base> {
  return (persistenceReload as unknown as (this: Base) => Promise<Base>).call(this);
}

export const InstanceMethods = {
  initializeDup,
  reload,
};
