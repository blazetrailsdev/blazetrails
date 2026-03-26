import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { CollectionAssociation } from "./collection-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasManyAssociation
 */
export class HasManyAssociation extends CollectionAssociation {
  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
  }
}
