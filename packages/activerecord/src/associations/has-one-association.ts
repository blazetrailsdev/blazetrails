import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import { SingularAssociation } from "./singular-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasOneAssociation
 */
export class HasOneAssociation extends SingularAssociation {
  constructor(owner: Base, reflection: AssociationReflection) {
    super(owner, reflection);
  }
}
