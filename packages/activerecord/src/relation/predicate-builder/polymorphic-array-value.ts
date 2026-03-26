/**
 * Handles polymorphic association values in where conditions,
 * expanding them into type + id pairs.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::PolymorphicArrayValue
 */
export class PolymorphicArrayValue {
  readonly associatedTable: any;
  readonly values: unknown[];

  constructor(associatedTable: any, values: unknown[]) {
    this.associatedTable = associatedTable;
    this.values = values;
  }
}
