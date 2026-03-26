/**
 * A Relation scoped to a specific association on a record.
 * Used as the base for CollectionProxy's query methods.
 *
 * Mirrors: ActiveRecord::AssociationRelation
 */
export class AssociationRelation {
  readonly association: any;
  readonly relation: any;

  constructor(association: any, relation: any) {
    this.association = association;
    this.relation = relation;
  }
}
