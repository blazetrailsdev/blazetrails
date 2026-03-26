import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { BelongsToAssociation } from "./belongs-to-association.js";

/**
 * Mirrors: ActiveRecord::Associations::BelongsToPolymorphicAssociation
 */
export class BelongsToPolymorphicAssociation extends BelongsToAssociation {
  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
  }
}
