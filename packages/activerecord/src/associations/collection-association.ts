import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { Association } from "./association.js";

/**
 * Base class for has_many and has_and_belongs_to_many associations.
 *
 * Mirrors: ActiveRecord::Associations::CollectionAssociation
 */
export class CollectionAssociation extends Association {
  declare target: Base[];

  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
    this.target = [];
  }

  get size(): number {
    if (this.loaded) {
      return this.target.length;
    }
    return this.countRecords();
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  protected countRecords(): number {
    return this.target.length;
  }
}
