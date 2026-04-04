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
        }
        break;

      default:
        await this.delete(dependent);
    }
  }

  /**
   * Delete the associated record using the given method.
   * Supports: delete, destroy, nullify, destroy_async.
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
        // Default: destroy
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

  private setOwnerAttributes(record: Base): void {
    const ownerAny = this.owner as any;
    const ctor = ownerAny.constructor;
    const primaryKey = this.reflection.options.primaryKey ?? ctor.primaryKey ?? "id";

    let fk: string;
    if (this.reflection.options.as) {
      fk =
        typeof this.reflection.options.foreignKey === "string"
          ? this.reflection.options.foreignKey
          : `${underscore(this.reflection.options.as)}_id`;
    } else {
      fk =
        typeof this.reflection.options.foreignKey === "string"
          ? this.reflection.options.foreignKey
          : `${underscore(ctor.name)}_id`;
    }

    (record as any)[fk] = ownerAny.readAttribute
      ? ownerAny.readAttribute(primaryKey as string)
      : ownerAny[primaryKey as string];

    if (this.reflection.options.as) {
      const typeCol = `${underscore(this.reflection.options.as)}_type`;
      (record as any)[typeCol] = ctor.name;
    }
  }

  private nullifyOwnerAttributes(record: Base): void {
    const ctor = (this.owner as any).constructor;
    let fk: string;
    if (this.reflection.options.as) {
      fk =
        typeof this.reflection.options.foreignKey === "string"
          ? this.reflection.options.foreignKey
          : `${underscore(this.reflection.options.as)}_id`;
    } else {
      fk =
        typeof this.reflection.options.foreignKey === "string"
          ? this.reflection.options.foreignKey
          : `${underscore(ctor.name)}_id`;
    }
    (record as any)[fk] = null;
  }
}
