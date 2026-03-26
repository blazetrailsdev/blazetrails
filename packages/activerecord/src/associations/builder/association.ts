/**
 * Base class for association builders. Configures association metadata
 * (reflection, callbacks, validations) based on options.
 *
 * Mirrors: ActiveRecord::Associations::Builder::Association
 */
export class Association {
  static validOptions(_options: Record<string, unknown>): string[] {
    return [
      "className",
      "foreignKey",
      "validate",
      "autosave",
      "dependent",
      "primaryKey",
      "inverseOf",
      "strict_loading",
      "ensuring_owner_was",
      "query_constraints",
    ];
  }

  static build(model: any, name: string, options: Record<string, unknown>): void {
    new this().build(model, name, options);
  }

  build(_model: any, _name: string, _options: Record<string, unknown>): void {
    // Subclasses define association on the model
  }
}
