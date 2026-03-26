import { Association } from "./association.js";

/**
 * Base builder for has_many and HABTM associations.
 *
 * Mirrors: ActiveRecord::Associations::Builder::CollectionAssociation
 */
export class CollectionAssociation extends Association {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [
      ...super.validOptions(options),
      "before_add",
      "after_add",
      "before_remove",
      "after_remove",
    ];
  }
}
