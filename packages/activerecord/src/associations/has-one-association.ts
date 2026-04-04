import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { loadHasOne } from "../associations.js";
import { DeleteRestrictionError } from "./errors.js";
import { underscore } from "@blazetrails/activesupport";
import { SingularAssociation } from "./singular-association.js";

/**
 * Manages has_one associations. Handles dependent destruction,
 * record replacement with FK nullification, and loading via
 * the loadHasOne function.
 *
 * Mirrors: ActiveRecord::Associations::HasOneAssociation
 */
export class HasOneAssociation extends SingularAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  /**
   * Handle the :dependent option when the owner is being destroyed.
   */
  async handleDependency(): Promise<void> {
    const dependent = this.reflection.options.dependent;

    switch (dependent) {
      case "restrictWithException":
        if (await this.loadTarget()) {
          throw new DeleteRestrictionError(this.owner, this.reflection.name);
        }
        break;

      case "restrictWithError":
        if (await this.loadTarget()) {
          const ownerAny = this.owner as any;
          if (typeof ownerAny.errors?.add === "function") {
            ownerAny.errors.add(
              "base",
              `Cannot delete record because dependent ${this.reflection.name} exists`,
            );
          }
          throw new DeleteRestrictionError(this.owner, this.reflection.name);
        }
        break;

      default:
        await this.delete(dependent);
    }
  }

  /**
   * Delete the associated record using the given method.
   * Supports: delete, destroy, nullify.
   */
  async delete(method?: string): Promise<void> {
    if (!(await this.loadTarget())) return;
    const target = this.target!;

    switch (method) {
      case "delete":
        if (typeof (target as any).delete === "function") {
          await (target as any).delete();
        }
        break;

      case "destroy":
        (target as any).destroyedByAssociation = this.reflection;
        if (typeof (target as any).destroy === "function") {
          await (target as any).destroy();
        }
        break;

      case "nullify":
        if (target.isPersisted()) {
          this.nullifyOwnerAttributes(target);
          if (typeof (target as any).save === "function") {
            await (target as any).save();
          }
        }
        break;

      default:
        if (typeof (target as any).destroy === "function") {
          await (target as any).destroy();
        }
    }
  }

  protected override replace(record: Base | null): void {
    if (record) {
      this.setOwnerAttributes(record);
    }
    super.replace(record);
  }

  protected override async doAsyncFindTarget(): Promise<Base | null> {
    return loadHasOne(this.owner, this.reflection.name, this.reflection.options);
  }

  private foreignKeyColumn(): string {
    if (typeof this.reflection.options.foreignKey === "string") {
      return this.reflection.options.foreignKey;
    }
    const ctor = (this.owner as any).constructor;
    if (this.reflection.options.as) {
      return `${underscore(this.reflection.options.as)}_id`;
    }
    return `${underscore(ctor.name)}_id`;
  }

  private setOwnerAttributes(record: Base): void {
    const ctor = (this.owner as any).constructor;
    const primaryKey = this.reflection.options.primaryKey ?? ctor.primaryKey ?? "id";
    const fk = this.foreignKeyColumn();
    const pkValue =
      typeof this.owner.readAttribute === "function"
        ? this.owner.readAttribute(primaryKey as string)
        : (this.owner as any)[primaryKey as string];

    if (typeof (record as any).writeAttribute === "function") {
      (record as any).writeAttribute(fk, pkValue);
    } else {
      (record as any)[fk] = pkValue;
    }

    if (this.reflection.options.as) {
      const typeCol = `${underscore(this.reflection.options.as)}_type`;
      if (typeof (record as any).writeAttribute === "function") {
        (record as any).writeAttribute(typeCol, ctor.name);
      } else {
        (record as any)[typeCol] = ctor.name;
      }
    }
  }

  private nullifyOwnerAttributes(record: Base): void {
    const fk = this.foreignKeyColumn();
    if (typeof (record as any).writeAttribute === "function") {
      (record as any).writeAttribute(fk, null);
    } else {
      (record as any)[fk] = null;
    }

    if (this.reflection.options.as) {
      const typeCol = `${underscore(this.reflection.options.as)}_type`;
      if (typeof (record as any).writeAttribute === "function") {
        (record as any).writeAttribute(typeCol, null);
      } else {
        (record as any)[typeCol] = null;
      }
    }
  }
}
