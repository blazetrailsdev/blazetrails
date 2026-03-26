import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::Builder::BelongsTo
 */
export class BelongsTo extends SingularAssociation {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [...super.validOptions(options), "polymorphic", "counter_cache", "optional", "default"];
  }
}
