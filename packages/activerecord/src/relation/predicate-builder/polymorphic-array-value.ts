/**
 * PolymorphicArrayValue — builds predicates for polymorphic association queries.
 *
 * Handles `where(commentable: [post, image])` by grouping by type and
 * building OR'd conditions for each type.
 *
 * Mirrors: ActiveRecord::PredicateBuilder::PolymorphicArrayValue
 */

export class PolymorphicArrayValue {
  private readonly associatedTable: string;
  private readonly foreignKey: string;
  private readonly foreignType: string;
  private readonly values: unknown[];

  constructor(associatedTable: string, foreignKey: string, foreignType: string, values: unknown[]) {
    this.associatedTable = associatedTable;
    this.foreignKey = foreignKey;
    this.foreignType = foreignType;
    this.values = values;
  }

  queries(): Array<Record<string, unknown>> {
    const grouped = new Map<string, unknown[]>();
    for (const value of this.values) {
      const type = (value as any).constructor.name;
      const id = (value as any).id;
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type)!.push(id);
    }
    const result: Array<Record<string, unknown>> = [];
    for (const [type, ids] of grouped) {
      result.push({
        [this.foreignType]: type,
        [this.foreignKey]: ids.length === 1 ? ids[0] : ids,
      });
    }
    return result;
  }
}
