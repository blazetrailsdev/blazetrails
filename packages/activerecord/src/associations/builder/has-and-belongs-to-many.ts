/**
 * Builder for has_and_belongs_to_many associations. Internally creates
 * a has_many :through with an anonymous join model.
 *
 * Mirrors: ActiveRecord::Associations::Builder::HasAndBelongsToMany
 */
export class HasAndBelongsToMany {
  static build(model: any, name: string, options: Record<string, unknown>): void {
    new this().build(model, name, options);
  }

  build(_model: any, _name: string, _options: Record<string, unknown>): void {
    // Subclasses define association on the model
  }
}
