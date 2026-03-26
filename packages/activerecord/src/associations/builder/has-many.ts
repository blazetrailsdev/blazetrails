import { CollectionAssociation } from "./collection-association.js";

/**
 * Mirrors: ActiveRecord::Associations::Builder::HasMany
 */
export class HasMany extends CollectionAssociation {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [
      ...super.validOptions(options),
      "as",
      "through",
      "source",
      "source_type",
      "disable_joins",
      "counter_cache",
    ];
  }

  protected override defineAssociation(
    model: any,
    name: string,
    options: Record<string, unknown>,
  ): void {
    model._associations.push({ type: "hasMany", name, options });
  }
}
