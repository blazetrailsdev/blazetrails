import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { loadHasMany } from "../associations.js";
import { DeleteRestrictionError } from "./errors.js";
import { CollectionAssociation } from "./collection-association.js";
import { underscore } from "@blazetrails/activesupport";

/**
 * Proxy that handles a has_many association.
 *
 * Adds counter cache awareness, dependent handling, and FK setup
 * on record insertion. Delegates collection behavior to
 * CollectionAssociation and load functions in associations.ts.
 *
 * Mirrors: ActiveRecord::Associations::HasManyAssociation
 */
export class HasManyAssociation extends CollectionAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  /**
   * Handle the :dependent option when the owner is being destroyed.
   * Supports: restrict_with_exception, restrict_with_error, destroy,
   * nullify, delete (delete_all).
   */
  async handleDependency(): Promise<void> {
    const dependent = this.reflection.options.dependent;

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
            const name = this.reflection.name;
            ownerAny.errors.add("base", `Cannot delete record because dependent ${name} exist`);
          }
        }
        break;

      case "destroy": {
        const records = await this.loadTarget();
        for (const record of records) {
          (record as any).destroyedByAssociation = this.reflection;
        }
        await this.destroyAll();
        break;
      }

      case "nullify":
        await this.deleteAll("nullify");
        break;

      default:
        await this.deleteAll();
    }
  }

  /**
   * Insert a record into the collection. Sets the FK and type
   * columns on the record to point to the owner, then saves.
   */
  /**
   * Insert a record into the collection. Sets the FK and type
   * columns on the record to point to the owner, then saves.
   * Rails: if raise is true, uses save! (raises on failure);
   * otherwise uses save (returns boolean).
   */
  async insertRecord(record: Base, validate = true, raise = false): Promise<boolean> {
    this.setOwnerAttributes(record);

    if (typeof (record as any).save === "function") {
      const saved = await (record as any).save({ validate });
      if (!saved && raise) {
        throw new Error(`Failed to save the new associated ${this.reflection.name}.`);
      }
      return !!saved;
    }
    return false;
  }

  protected override async doAsyncFindTarget(): Promise<Base[]> {
    return loadHasMany(this.owner, this.reflection.name, this.reflection.options);
  }

  protected override setOwnerAttributes(record: Base): void {
    const ownerAny = this.owner as any;
    const ctor = ownerAny.constructor;
    const primaryKey = this.reflection.options.primaryKey ?? ctor.primaryKey ?? "id";

    // Determine FK column name
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

    // Set polymorphic type column
    if (this.reflection.options.as) {
      const typeCol = `${underscore(this.reflection.options.as)}_type`;
      (record as any)[typeCol] = ctor.name;
    }
  }
}
