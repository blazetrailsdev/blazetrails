import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::BelongsToAssociation
 */
export class BelongsToAssociation extends SingularAssociation {
  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
  }

  get updated(): boolean {
    return this.owner.savedChangeToAttribute(this.reflection.foreignKey as string);
  }
}
