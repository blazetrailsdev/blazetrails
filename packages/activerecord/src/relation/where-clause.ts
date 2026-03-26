/**
 * Represents the WHERE conditions on a Relation. Wraps an array
 * of Arel predicates.
 *
 * Mirrors: ActiveRecord::Relation::WhereClause
 */
export class WhereClause {
  readonly predicates: any[];

  constructor(predicates: any[] = []) {
    this.predicates = predicates;
  }

  get empty(): boolean {
    return this.predicates.length === 0;
  }

  merge(other: WhereClause): WhereClause {
    return new WhereClause([...this.predicates, ...other.predicates]);
  }

  except(...columns: string[]): WhereClause {
    const filtered = this.predicates.filter((p: any) => {
      const attr = p?.left?.name ?? p?.attribute?.name;
      return !attr || !columns.includes(attr);
    });
    return new WhereClause(filtered);
  }
}
