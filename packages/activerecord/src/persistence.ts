/**
 * Persistence — class methods for creating, instantiating, and
 * configuring query constraints on ActiveRecord models.
 *
 * Mirrors: ActiveRecord::Persistence::ClassMethods
 */

interface PersistenceHost {
  new (attrs?: Record<string, unknown>): any;
  _instantiate(row: Record<string, unknown>): any;
  primaryKey: string | string[];
  _queryConstraintsList?: string[] | null;
  _hasQueryConstraints?: boolean;
  baseClass?: () => PersistenceHost;
}

export function build(
  this: PersistenceHost,
  attrs: Record<string, unknown> | Record<string, unknown>[] = {},
): any {
  if (Array.isArray(attrs)) {
    return attrs.map((a) => new this(a));
  }
  return new this(attrs);
}

export function instantiate(this: PersistenceHost, attributes: Record<string, unknown>): any {
  return this._instantiate(attributes);
}

export function queryConstraints(this: PersistenceHost, ...columns: string[]): void {
  if (columns.length === 0) {
    throw new Error("You must specify at least one column to be used in querying");
  }
  this._queryConstraintsList = columns.map(String);
  this._hasQueryConstraints = true;
}

export function hasQueryConstraints(this: PersistenceHost): boolean {
  return this._hasQueryConstraints ?? false;
}

export function queryConstraintsList(this: PersistenceHost): string[] | null {
  if (this._queryConstraintsList) return this._queryConstraintsList;
  const pk = this.primaryKey;
  if (Array.isArray(pk)) return pk;
  if (this.baseClass) {
    const base = this.baseClass();
    if (base !== (this as any)) return queryConstraintsList.call(base);
  }
  return null;
}

export function compositeQueryConstraintsList(this: PersistenceHost): string[] {
  const list = queryConstraintsList.call(this);
  if (list) return list;
  const pk = this.primaryKey;
  return Array.isArray(pk) ? pk : [pk];
}
