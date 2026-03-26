/**
 * Handles passing an association record as a where value:
 * where({ author: authorRecord }) becomes where({ author_id: 1 }).
 *
 * Mirrors: ActiveRecord::PredicateBuilder::AssociationQueryValue
 */
export class AssociationQueryValue {
  readonly associatedTable: any;
  readonly values: unknown[];

  constructor(associatedTable: any, values: unknown[]) {
    this.associatedTable = associatedTable;
    this.values = values;
  }
}
