import { Association } from "./association.js";

/**
 * Base builder for has_one and belongs_to associations.
 *
 * Mirrors: ActiveRecord::Associations::Builder::SingularAssociation
 */
export class SingularAssociation extends Association {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [...super.validOptions(options), "required", "touch"];
  }

  static override defineAccessors(model: any, reflection: any): void {
    super.defineAccessors(model, reflection);
    const mixin =
      typeof model.generatedAssociationMethods === "function"
        ? model.generatedAssociationMethods()
        : null;
    const name = reflection.name ?? reflection;

    if (!reflection.options?.polymorphic) {
      this.defineConstructors(mixin, name);
    }

    if (mixin instanceof Set) {
      mixin.add(`reload${name.charAt(0).toUpperCase()}${name.slice(1)}`);
      mixin.add(`reset${name.charAt(0).toUpperCase()}${name.slice(1)}`);
    }
  }

  static defineConstructors(mixin: any, name: string): void {
    if (mixin instanceof Set) {
      mixin.add(`build${name.charAt(0).toUpperCase()}${name.slice(1)}`);
      mixin.add(`create${name.charAt(0).toUpperCase()}${name.slice(1)}`);
      mixin.add(`create${name.charAt(0).toUpperCase()}${name.slice(1)}!`);
    }
  }
}
