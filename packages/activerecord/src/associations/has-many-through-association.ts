import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { HasManyAssociation } from "./has-many-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasManyThroughAssociation
 */
export class HasManyThroughAssociation extends HasManyAssociation {
  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
  }
}
