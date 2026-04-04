import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { DeleteRestrictionError } from "./errors.js";
import { CollectionAssociation } from "./collection-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasManyAssociation
 */
export class HasManyAssociation extends CollectionAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  handleDependency(): void {
    const dependent = this.reflection.options.dependent;
    if (!dependent) {
      this.deleteAll();
      return;
    }

    switch (dependent) {
      case "restrictWithException":
        if (!this.isEmpty()) {
          throw new DeleteRestrictionError(this.owner, this.reflection.name);
        }
        break;

      case "restrictWithError":
        if (!this.isEmpty()) {
          const ownerAny = this.owner as any;
          if (typeof ownerAny.errors?.add === "function") {
            ownerAny.errors.add(
              "base",
              `Cannot delete record because dependent ${this.reflection.name} exist`,
            );
          }
        }
        break;

      case "destroy":
        this.loadTarget();
        this.destroyAll();
        break;

      default:
        this.deleteAll();
    }
  }

  insertRecord(record: Base, validate = true, raise = false): boolean {
    this.setOwnerAttributes(record);
    if (raise) {
      if (typeof (record as any).saveBang === "function") {
        (record as any).saveBang({ validate });
        return true;
      }
    }
    if (typeof (record as any).save === "function") {
      return (record as any).save({ validate });
    }
    return false;
  }

  private setOwnerAttributes(record: Base): void {
    const fk = this.reflection.options.foreignKey;
    if (fk && typeof fk === "string") {
      (record as any)[fk] = (this.owner as any).id;
    }
  }
}
