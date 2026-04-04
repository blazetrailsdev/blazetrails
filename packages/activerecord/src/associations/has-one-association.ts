import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { DeleteRestrictionError } from "./errors.js";
import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasOneAssociation
 */
export class HasOneAssociation extends SingularAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  handleDependency(): void {
    const dependent = this.reflection.options.dependent;

    switch (dependent) {
      case "restrictWithException":
        if (this.loadTarget()) {
          throw new DeleteRestrictionError(this.owner, this.reflection.name);
        }
        break;

      case "restrictWithError":
        if (this.loadTarget()) {
          const ownerAny = this.owner as any;
          if (typeof ownerAny.errors?.add === "function") {
            ownerAny.errors.add(
              "base",
              `Cannot delete record because dependent ${this.reflection.name} exists`,
            );
          }
        }
        break;

      default:
        this.delete(dependent);
    }
  }

  delete(method?: string): void {
    if (!this.loadTarget()) return;

    switch (method) {
      case "delete":
        if (typeof (this.target as any)?.delete === "function") {
          (this.target as any).delete();
        }
        break;

      case "destroy":
        if (typeof (this.target as any)?.destroy === "function") {
          (this.target as any).destroy();
        }
        break;

      case "nullify":
        if (this.target && (this.target as any).isPersisted?.()) {
          const fk = this.reflection.options.foreignKey;
          if (fk && typeof fk === "string") {
            (this.target as any)[fk] = null;
            if (typeof (this.target as any).save === "function") {
              (this.target as any).save();
            }
          }
        }
        break;

      default:
        if (typeof (this.target as any)?.destroy === "function") {
          (this.target as any).destroy();
        }
    }
  }

  protected override replace(record: Base | null): void {
    if (record) {
      const fk = this.reflection.options.foreignKey;
      if (fk && typeof fk === "string") {
        (record as any)[fk] = (this.owner as any).id;
      }
      this.setInverseInstance(record);
    }
    super.replace(record);
  }
}
