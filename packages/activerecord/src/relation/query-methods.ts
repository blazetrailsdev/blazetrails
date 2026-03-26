/**
 * Query methods mixed into Relation: where, order, group, having,
 * limit, offset, joins, includes, select, distinct, etc.
 *
 * Mirrors: ActiveRecord::QueryMethods
 */
export class QueryMethods {
  static readonly MULTI_VALUE_METHODS = [
    "includes",
    "eagerLoad",
    "preload",
    "select",
    "group",
    "order",
    "joins",
    "leftOuterJoins",
    "references",
    "extending",
    "unscope",
    "optimizer_hints",
    "annotate",
  ] as const;

  static readonly SINGLE_VALUE_METHODS = [
    "limit",
    "offset",
    "lock",
    "readonly",
    "reordering",
    "distinct",
    "strictLoading",
  ] as const;
}

/**
 * Provides chainable where.not(), where.associated(), where.missing().
 *
 * Mirrors: ActiveRecord::QueryMethods::WhereChain
 */
export class WhereChain {
  private _scope: any;

  constructor(scope: any) {
    this._scope = scope;
  }

  not(conditions: Record<string, unknown>): any {
    return this._scope.whereNot(conditions);
  }

  associated(...associationNames: string[]): any {
    return this._scope.whereAssociated(...associationNames);
  }

  missing(...associationNames: string[]): any {
    return this._scope.whereMissing(...associationNames);
  }
}

/**
 * Internal node representing a CTE-based JOIN.
 *
 * Mirrors: ActiveRecord::QueryMethods::CTEJoin
 */
export class CTEJoin {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}
