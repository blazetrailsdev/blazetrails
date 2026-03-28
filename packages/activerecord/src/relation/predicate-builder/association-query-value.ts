/**
 * AssociationQueryValue — builds predicates for association-based queries.
 *
 * Handles `where(author: user)` by converting to `where(author_id: user.id)`.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::AssociationQueryValue
 */

export class AssociationQueryValue {
  private readonly associatedTable: string;
  private readonly primaryKey: string;
  private readonly foreignKey: string;
  private readonly value: unknown;

  constructor(associatedTable: string, primaryKey: string, foreignKey: string, value: unknown) {
    this.associatedTable = associatedTable;
    this.primaryKey = primaryKey;
    this.foreignKey = foreignKey;
    this.value = value;
  }

  queries(): Record<string, unknown> {
    if (this.value === null || this.value === undefined) {
      return { [this.foreignKey]: null };
    }
    if (Array.isArray(this.value)) {
      return { [this.foreignKey]: this.value.map((v: any) => v[this.primaryKey]) };
    }
    return { [this.foreignKey]: (this.value as any)[this.primaryKey] };
  }
}
