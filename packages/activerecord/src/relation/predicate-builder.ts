/**
 * Converts hash conditions ({ name: "dean", age: 30 }) into
 * Arel predicates (name = 'dean' AND age = 30).
 *
 * Mirrors: ActiveRecord::PredicateBuilder
 */
export class PredicateBuilder {
  readonly table: any;

  constructor(table: any) {
    this.table = table;
  }

  buildFromHash(attributes: Record<string, unknown>): any[] {
    const predicates: any[] = [];
    for (const [key, value] of Object.entries(attributes)) {
      predicates.push(this.buildPredicate(key, value));
    }
    return predicates;
  }

  private buildPredicate(key: string, value: unknown): any {
    const attribute = this.table[key];
    if (Array.isArray(value)) {
      return attribute?.in(value);
    }
    return attribute?.eq(value);
  }
}
