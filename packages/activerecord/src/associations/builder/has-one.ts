import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::Builder::HasOne
 */
export class HasOne extends SingularAssociation {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [
      ...super.validOptions(options),
      "as",
      "through",
      "source",
      "source_type",
      "disable_joins",
    ];
  }
}
