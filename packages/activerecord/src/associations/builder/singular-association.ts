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
    const mixin = model.prototype ?? model;
    const name = reflection.name ?? reflection;
    const cap = name.charAt(0).toUpperCase() + name.slice(1);

    if (!reflection.options?.polymorphic) {
      this.defineConstructors(mixin, name);
    }

    if (mixin && typeof mixin === "object") {
      if (!(`reload${cap}` in mixin)) {
        mixin[`reload${cap}`] = function (this: any) {
          return this.association(name).forceReloadReader();
        };
      }
      if (!(`reset${cap}` in mixin)) {
        mixin[`reset${cap}`] = function (this: any) {
          return this.association(name).reset();
        };
      }
    }
  }

  static defineConstructors(mixin: any, name: string): void {
    if (!mixin || typeof mixin !== "object") return;
    const cap = name.charAt(0).toUpperCase() + name.slice(1);

    if (!(`build${cap}` in mixin)) {
      mixin[`build${cap}`] = function (this: any, ...args: any[]) {
        return this.association(name).build(...args);
      };
    }
    if (!(`create${cap}` in mixin)) {
      mixin[`create${cap}`] = function (this: any, ...args: any[]) {
        return this.association(name).create(...args);
      };
    }
    if (!(`create${cap}Bang` in mixin)) {
      mixin[`create${cap}Bang`] = function (this: any, ...args: any[]) {
        return this.association(name).createBang(...args);
      };
    }
  }
}
