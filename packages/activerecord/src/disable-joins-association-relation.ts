import { AssociationRelation } from "./association-relation.js";

/**
 * An AssociationRelation that queries each database separately
 * instead of using JOINs, for multi-database through associations.
 *
 * Mirrors: ActiveRecord::DisableJoinsAssociationRelation
 */
export class DisableJoinsAssociationRelation extends AssociationRelation {
  constructor(association: any, relation: any) {
    super(association, relation);
  }
}
