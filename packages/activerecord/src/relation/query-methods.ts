/**
 * Query methods mixed into Relation: where, order, group, having,
 * limit, offset, joins, includes, select, distinct, etc.
 *
 * Mirrors: ActiveRecord::QueryMethods
 */
import { Nodes, Visitors } from "@blazetrails/arel";
import { FromClause } from "./from-clause.js";
import { WhereClause } from "./where-clause.js";
import { IrreversibleOrderError } from "../errors.js";
import { sanitizeSqlArray } from "../sanitization.js";
import { quote } from "../connection-adapters/abstract/quoting.js";

/**
 * Interface for the scope that WhereChain delegates to.
 */
export interface WhereChainScope<R> {
  whereNot(conditions: Record<string, unknown>): R;
  whereAssociated(...associationNames: string[]): R;
  whereMissing(...associationNames: string[]): R;
}

/**
 * Provides chainable where.not(), where.associated(), where.missing().
 * Returned by `Relation#where()` when called with no arguments.
 *
 * Mirrors: ActiveRecord::QueryMethods::WhereChain
 */
export class WhereChain<R = any> {
  private _scope: WhereChainScope<R>;

  constructor(scope: WhereChainScope<R>) {
    this._scope = scope;
  }

  not(conditions: Record<string, unknown>): R {
    return this._scope.whereNot(conditions);
  }

  associated(...associationNames: string[]): R {
    return this._scope.whereAssociated(...associationNames);
  }

  missing(...associationNames: string[]): R {
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

// ---------------------------------------------------------------------------
// Host interface: the shape of `this` for bang methods mixed into Relation.
// Uses TS `private` keyword fields which are accessible at runtime.
// ---------------------------------------------------------------------------
interface QueryMethodsHost {
  _whereClause: WhereClause;
  _orderClauses: Array<string | [string, "asc" | "desc"]>;
  _rawOrderClauses: string[];
  _limitValue: number | null;
  _offsetValue: number | null;
  _selectColumns: any[] | null;
  _isDistinct: boolean;
  _distinctOnColumns: string[];
  _groupColumns: string[];
  _orRelations: any[];
  _havingClauses: string[];
  _isNone: boolean;
  _lockValue: string | null;
  _joinClauses: Array<{ type: "inner" | "left"; table: string; on: string }>;
  _rawJoins: string[];
  _includesAssociations: string[];
  _preloadAssociations: string[];
  _eagerLoadAssociations: string[];
  _isReadonly: boolean;
  _isStrictLoading: boolean;
  _annotations: string[];
  _optimizerHints: string[];
  _referencesValues: string[];
  _fromClause: FromClause;
  _createWithAttrs: Record<string, unknown>;
  _extending: Array<Record<string, Function>>;
  _ctes: Array<{ name: string; sql: string; recursive: boolean }>;
  _skipPreloading: boolean;
  _skipQueryCache: boolean;
  _modelClass: any;
  predicateBuilder: import("./predicate-builder.js").PredicateBuilder;
  _castWhereValue(key: string, value: unknown): unknown;
}

// ---------------------------------------------------------------------------
// Bang variants — mutate `this` in place, return `this`.
// In Rails, every query method `foo` has a `foo!` that mutates self.
// The non-bang version calls `spawn.foo!` (clone then mutate).
// ---------------------------------------------------------------------------

function includesBang(this: QueryMethodsHost, ...associations: string[]): any {
  this._includesAssociations.push(...associations);
  return this;
}

function eagerLoadBang(this: QueryMethodsHost, ...associations: string[]): any {
  this._eagerLoadAssociations.push(...associations);
  return this;
}

function preloadBang(this: QueryMethodsHost, ...associations: string[]): any {
  this._preloadAssociations.push(...associations);
  return this;
}

function referencesBang(this: QueryMethodsHost, ...tables: string[]): any {
  for (const t of tables) {
    if (t && !this._referencesValues.includes(t)) this._referencesValues.push(t);
  }
  return this;
}

function withBang(this: QueryMethodsHost, ...ctes: Array<Record<string, any>>): any {
  for (const cte of ctes) {
    for (const [name, query] of Object.entries(cte)) {
      const sql = typeof query === "string" ? query : query.toSql();
      this._ctes.push({ name, sql, recursive: false });
    }
  }
  return this;
}

function withRecursiveBang(this: QueryMethodsHost, ...ctes: Array<Record<string, any>>): any {
  for (const cte of ctes) {
    for (const [name, query] of Object.entries(cte)) {
      const sql = typeof query === "string" ? query : query.toSql();
      this._ctes.push({ name, sql, recursive: true });
    }
  }
  return this;
}

function reselectBang(this: QueryMethodsHost, ...columns: any[]): any {
  this._selectColumns = columns.map((c: any) =>
    typeof c === "object" && c !== null && "value" in c ? c : String(c),
  );
  return this;
}

/**
 * Union additional select columns into the existing list. Mirrors Rails'
 * private `_select!` which uses `select_values |= fields.flatten`.
 */
function _selectBang(this: QueryMethodsHost, ...columns: any[]): any {
  const flat = columns.flat(Infinity);
  const normalized = flat.map((c: any) =>
    typeof c === "object" && c !== null && "value" in c ? c : String(c),
  );
  if (this._selectColumns === null) {
    this._selectColumns = normalized;
  } else {
    const seen = new Set(
      this._selectColumns.map((c) => (typeof c === "string" ? c : (c as any).value)),
    );
    for (const col of normalized) {
      const key = typeof col === "string" ? col : (col as any).value;
      if (!seen.has(key)) {
        this._selectColumns.push(col);
        seen.add(key);
      }
    }
  }
  return this;
}

function groupBang(this: QueryMethodsHost, ...columns: string[]): any {
  this._groupColumns.push(...columns);
  return this;
}

function regroupBang(this: QueryMethodsHost, ...columns: string[]): any {
  this._groupColumns = [...columns];
  return this;
}

function orderBang(
  this: QueryMethodsHost,
  ...args: Array<string | Record<string, "asc" | "desc">>
): any {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (typeof arg === "string") {
      const next = args[i + 1];
      if (typeof next === "string" && /^(asc|desc)$/i.test(next)) {
        this._orderClauses.push([arg, next.toLowerCase() as "asc" | "desc"]);
        i += 2;
        continue;
      }
      this._orderClauses.push(arg);
    } else {
      for (const [col, dir] of Object.entries(arg)) {
        this._orderClauses.push([col, dir]);
      }
    }
    i++;
  }
  return this;
}

function reorderBang(
  this: QueryMethodsHost,
  ...args: Array<string | Record<string, "asc" | "desc">>
): any {
  this._orderClauses = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      this._orderClauses.push(arg);
    } else {
      for (const [col, dir] of Object.entries(arg)) {
        this._orderClauses.push([col, dir]);
      }
    }
  }
  return this;
}

/**
 * Valid argument values for `unscope` — matches Rails' VALID_UNSCOPING_VALUES.
 * `left_joins` is accepted as an alias for `leftOuterJoins` (matching Rails).
 */
export type UnscopeType =
  | "where"
  | "select"
  | "group"
  | "order"
  | "lock"
  | "limit"
  | "offset"
  | "joins"
  | "leftOuterJoins"
  | "includes"
  | "from"
  | "readonly"
  | "having"
  | "optimizerHints"
  | "annotate";

const VALID_UNSCOPING_VALUES: ReadonlySet<string> = new Set([
  "where",
  "select",
  "group",
  "order",
  "lock",
  "limit",
  "offset",
  "joins",
  "left_outer_joins",
  "leftOuterJoins",
  "includes",
  "from",
  "readonly",
  "having",
  "optimizer_hints",
  "optimizerHints",
  "annotate",
]);

function unscopeBang(
  this: QueryMethodsHost,
  ...types: Array<string | { where: string | string[] }>
): any {
  for (const scope of types) {
    if (typeof scope === "string") {
      const key = scope === "left_joins" ? "leftOuterJoins" : scope;
      if (!VALID_UNSCOPING_VALUES.has(key)) {
        throw new Error(
          `Called unscope() with invalid unscoping argument '${scope}'. Valid arguments are: ${[...VALID_UNSCOPING_VALUES].join(", ")}.`,
        );
      }
      switch (key) {
        case "where":
          this._whereClause = WhereClause.empty();
          break;
        case "order":
          this._orderClauses = [];
          break;
        case "limit":
          this._limitValue = null;
          break;
        case "offset":
          this._offsetValue = null;
          break;
        case "group":
          this._groupColumns = [];
          break;
        case "having":
          this._havingClauses = [];
          break;
        case "select":
          this._selectColumns = null;
          break;
        case "lock":
          this._lockValue = null;
          break;
        case "readonly":
          this._isReadonly = false;
          break;
        case "from":
          this._fromClause = FromClause.empty();
          break;
        case "joins":
          this._joinClauses = [];
          this._rawJoins = [];
          break;
        case "left_outer_joins":
        case "leftOuterJoins":
          this._joinClauses = this._joinClauses.filter((j) => j.type !== "left");
          break;
        case "includes":
          this._includesAssociations = [];
          this._eagerLoadAssociations = [];
          this._preloadAssociations = [];
          break;
        case "optimizer_hints":
        case "optimizerHints":
          this._optimizerHints = [];
          break;
        case "annotate":
          this._annotations = [];
          break;
      }
    } else if (scope && typeof scope === "object") {
      for (const [key, target] of Object.entries(scope)) {
        if (key !== "where") {
          throw new Error(`Hash arguments in .unscope(*args) must have :where as the key.`);
        }
        const targets = Array.isArray(target) ? target : [target];
        this._whereClause = this._whereClause.except(...targets);
      }
    } else {
      throw new Error(
        `Unrecognized scoping: ${JSON.stringify(scope)}. Use .unscope(where: :attribute_name) or one of ${[...VALID_UNSCOPING_VALUES].join(", ")}.`,
      );
    }
  }
  return this;
}

function joinsBang(this: QueryMethodsHost, ...args: string[]): any {
  for (const arg of args) {
    this._rawJoins.push(arg);
  }
  return this;
}

function leftOuterJoinsBang(this: QueryMethodsHost, ...args: string[]): any {
  for (const arg of args) {
    this._rawJoins.push(arg);
  }
  return this;
}

function whereBang(this: QueryMethodsHost, opts: any, ...rest: unknown[]): any {
  if (opts == null) return this;

  if (opts instanceof Nodes.Node) {
    this._whereClause.predicates.push(opts);
    return this;
  }

  if (typeof opts === "string") {
    let sql: string;
    if (
      rest.length === 1 &&
      typeof rest[0] === "object" &&
      rest[0] !== null &&
      !Array.isArray(rest[0])
    ) {
      sql = opts;
      const namedBinds = rest[0] as Record<string, unknown>;
      for (const [name, value] of Object.entries(namedBinds)) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        sql = sql.replace(new RegExp(`:${escaped}\\b`, "g"), quote(value));
      }
    } else if (rest.length > 0) {
      sql = sanitizeSqlArray(opts, ...rest);
    } else {
      sql = opts;
    }
    if (sql.trim()) this._whereClause.predicates.push(new Nodes.SqlLiteral(sql));
    return this;
  }

  if (typeof opts !== "object" || Array.isArray(opts)) {
    const err = new Error(`Unsupported argument type: ${typeof opts} (${String(opts)})`);
    err.name = "ArgumentError";
    throw err;
  }

  const cast: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts as Record<string, unknown>)) {
    if (isRelationLike(value)) {
      cast[key] = value;
    } else {
      cast[key] = Array.isArray(value)
        ? value.map((v) => this._castWhereValue(key, v))
        : this._castWhereValue(key, value);
    }
  }
  this._whereClause.predicates.push(...this.predicateBuilder.buildFromHash(cast));
  return this;
}

function isRelationLike(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { _whereClause?: unknown })._whereClause === "object" &&
    typeof (value as { toSql?: unknown }).toSql === "function"
  );
}

function invertWhereBang(this: QueryMethodsHost): any {
  this._whereClause = this._whereClause.invert();
  return this;
}

/**
 * Names of the relation fields that are structurally compared by and!/or!.
 * Mirrors Rails' STRUCTURAL_VALUE_METHODS (Relation::VALUE_METHODS minus
 * extending, where, having, unscope, references, annotate, optimizer_hints).
 */
const STRUCTURAL_FIELDS: ReadonlyArray<[string, keyof QueryMethodsHost]> = [
  ["includes", "_includesAssociations"],
  ["eagerLoad", "_eagerLoadAssociations"],
  ["preload", "_preloadAssociations"],
  ["select", "_selectColumns"],
  ["group", "_groupColumns"],
  ["order", "_orderClauses"],
  ["joins", "_joinClauses"],
  ["leftOuterJoins", "_rawJoins"],
  ["limit", "_limitValue"],
  ["offset", "_offsetValue"],
  ["lock", "_lockValue"],
  ["distinct", "_isDistinct"],
  ["readonly", "_isReadonly"],
  ["strictLoading", "_isStrictLoading"],
  ["from", "_fromClause"],
  ["createWith", "_createWithAttrs"],
];

function structurallyIncompatibleValuesFor(
  self: QueryMethodsHost,
  other: QueryMethodsHost,
): string[] {
  const incompat: string[] = [];
  for (const [label, field] of STRUCTURAL_FIELDS) {
    const a = self[field] as unknown;
    const b = other[field] as unknown;
    if (Array.isArray(a) && Array.isArray(b)) {
      const ua = [...new Set(a.map((x) => JSON.stringify(x)))].sort();
      const ub = [...new Set(b.map((x) => JSON.stringify(x)))].sort();
      if (ua.length !== ub.length || ua.some((v, i) => v !== ub[i])) incompat.push(label);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      incompat.push(label);
    }
  }
  return incompat;
}

function assertRelationForCombining(other: unknown, methodName: string): void {
  if (
    !other ||
    typeof other !== "object" ||
    typeof (other as { _whereClause?: unknown })._whereClause !== "object"
  ) {
    const err = new Error(
      `You have passed ${typeof other} object to #${methodName}. Pass an ActiveRecord::Relation object instead.`,
    );
    err.name = "ArgumentError";
    throw err;
  }
}

function assertStructurallyCompatible(
  self: QueryMethodsHost,
  other: QueryMethodsHost,
  methodName: string,
): void {
  const incompat = structurallyIncompatibleValuesFor(self, other);
  if (incompat.length > 0) {
    const err = new Error(
      `Relation passed to #${methodName} must be structurally compatible. Incompatible values: [${incompat.map((v) => `:${v}`).join(", ")}]`,
    );
    err.name = "ArgumentError";
    throw err;
  }
}

/**
 * Returns true if `self` and `other` are structurally compatible for
 * and!/or! combining — exposed as a helper so Relation#structurally_compatible?
 * can share the same check.
 */
export function areStructurallyCompatible(self: unknown, other: unknown): boolean {
  if (
    !self ||
    typeof self !== "object" ||
    !other ||
    typeof other !== "object" ||
    typeof (self as { _whereClause?: unknown })._whereClause !== "object" ||
    typeof (other as { _whereClause?: unknown })._whereClause !== "object"
  ) {
    return false;
  }
  return (
    structurallyIncompatibleValuesFor(self as QueryMethodsHost, other as QueryMethodsHost)
      .length === 0
  );
}

function andBang(this: QueryMethodsHost, other: any): any {
  assertRelationForCombining(other, "and");
  assertStructurallyCompatible(this, other, "and");
  this._whereClause = this._whereClause.merge(other._whereClause);
  // Having and references are stored as string[] here; union/dedupe.
  const unionStrings = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  this._havingClauses = unionStrings(this._havingClauses, other._havingClauses);
  this._referencesValues = unionStrings(this._referencesValues, other._referencesValues);
  return this;
}

function orBang(this: QueryMethodsHost, other: any): any {
  assertRelationForCombining(other, "or");
  assertStructurallyCompatible(this, other, "or");
  this._orRelations = [...this._orRelations, other];
  const unionStrings = (a: string[], b: string[]): string[] => [...new Set([...a, ...b])];
  this._referencesValues = unionStrings(this._referencesValues, other._referencesValues);
  return this;
}

function havingBang(
  this: QueryMethodsHost,
  opts: string | Record<string, unknown> | Nodes.Node,
  ...rest: unknown[]
): any {
  if (opts == null || (typeof opts === "string" && opts.trim() === "")) return this;

  if (typeof opts === "string") {
    const sql = rest.length > 0 ? sanitizeSqlArray(opts, ...rest) : opts;
    this._havingClauses.push(sql);
    return this;
  }

  if (opts instanceof Nodes.Node) {
    this._havingClauses.push(new Visitors.ToSql().compile(opts));
    return this;
  }

  const cast: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(opts)) {
    cast[key] = Array.isArray(value)
      ? value.map((v) => this._castWhereValue(key, v))
      : this._castWhereValue(key, value);
  }
  const visitor = new Visitors.ToSql();
  for (const node of this.predicateBuilder.buildFromHash(cast)) {
    this._havingClauses.push(visitor.compile(node));
  }
  return this;
}

function limitBang(this: QueryMethodsHost, value: number | null): any {
  if (value == null) {
    this._limitValue = null;
    return this;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < 0) {
    throw new Error(`Invalid limit value: ${String(value)}`);
  }
  this._limitValue = num;
  return this;
}

function offsetBang(this: QueryMethodsHost, value: number): any {
  this._offsetValue = value;
  return this;
}

function lockBang(this: QueryMethodsHost, locks: string | boolean = true): any {
  if (typeof locks === "string") {
    this._lockValue = locks;
  } else {
    this._lockValue = locks ? "FOR UPDATE" : null;
  }
  return this;
}

function noneBang(this: QueryMethodsHost): any {
  if (!this._isNone) {
    this._whereClause.predicates.push(new Nodes.SqlLiteral("1=0"));
    this._isNone = true;
  }
  return this;
}

function isNullRelation(this: QueryMethodsHost): boolean {
  return this._isNone;
}

function readonlyBang(this: QueryMethodsHost, value = true): any {
  this._isReadonly = value;
  return this;
}

function strictLoadingBang(this: QueryMethodsHost, value = true): any {
  this._isStrictLoading = value;
  return this;
}

function createWithBang(this: QueryMethodsHost, value: Record<string, unknown> | null): any {
  if (value) {
    this._createWithAttrs = { ...this._createWithAttrs, ...value };
  } else {
    this._createWithAttrs = {};
  }
  return this;
}

function fromBang(this: QueryMethodsHost, value: any, subqueryName?: string): any {
  this._fromClause = new FromClause(value ?? null, subqueryName ?? null);
  return this;
}

function distinctBang(this: QueryMethodsHost, value = true): any {
  this._isDistinct = value;
  return this;
}

function extendingBang(
  this: QueryMethodsHost,
  ...modules: Array<Record<string, Function> | ((rel: any) => void)>
): any {
  for (const mod of modules) {
    if (typeof mod === "function") {
      mod(this);
    } else {
      this._extending.push(mod);
      for (const [name, fn] of Object.entries(mod)) {
        (this as any)[name] = fn.bind(this);
      }
    }
  }
  return this;
}

function optimizerHintsBang(this: QueryMethodsHost, ...hints: string[]): any {
  this._optimizerHints.push(...hints);
  return this;
}

function reverseOrderBang(this: QueryMethodsHost): any {
  this._orderClauses = this._orderClauses.map((clause) => {
    if (typeof clause === "string") {
      const match = clause.match(/^([\w.]+)\s+(ASC|DESC)$/i);
      if (match) {
        const col = match[1];
        const dir = match[2].toUpperCase() === "ASC" ? "desc" : "asc";
        return [col, dir] as [string, "asc" | "desc"];
      }
      if (/[(),]/.test(clause) || /\bCASE\b/i.test(clause)) {
        throw new IrreversibleOrderError(
          `Relation has a non-reversible order and cannot be reversed: ${clause}`,
        );
      }
      return [clause, "desc" as const];
    }
    const [col, dir] = clause;
    return [col, dir === "asc" ? "desc" : "asc"] as [string, "asc" | "desc"];
  });
  return this;
}

function skipQueryCacheBang(this: QueryMethodsHost, value = true): any {
  this._skipQueryCache = value;
  return this;
}

function skipPreloadingBang(this: QueryMethodsHost): any {
  this._skipPreloading = true;
  return this;
}

function annotateBang(this: QueryMethodsHost, ...comments: string[]): any {
  this._annotations.push(...comments);
  return this;
}

function uniqBang(this: QueryMethodsHost, _name?: string): any {
  this._isDistinct = true;
  return this;
}

function excludingBang(this: QueryMethodsHost, records: any[]): any {
  const primaryKey = this._modelClass.primaryKey;
  if (Array.isArray(primaryKey)) {
    throw new Error("excluding does not support models with composite primary keys");
  }
  const pk = primaryKey as string;
  const ids = records.map((r: any) => (typeof r === "object" && r !== null ? (r.id ?? r) : r));
  this._whereClause.predicates.push(...this.predicateBuilder.buildNegatedFromHash({ [pk]: ids }));
  return this;
}

function constructJoinDependency(this: QueryMethodsHost, _associations: any, _joinType: any): any {
  return { associations: _associations, joinType: _joinType, model: this._modelClass };
}

// ---------------------------------------------------------------------------
// Module export — all bang variants as a single object for `include()`.
// ---------------------------------------------------------------------------
export const QueryMethodBangs = {
  includesBang,
  eagerLoadBang,
  preloadBang,
  referencesBang,
  withBang,
  withRecursiveBang,
  reselectBang,
  _selectBang,
  groupBang,
  regroupBang,
  orderBang,
  reorderBang,
  unscopeBang,
  joinsBang,
  leftOuterJoinsBang,
  whereBang,
  invertWhereBang,
  andBang,
  orBang,
  havingBang,
  limitBang,
  offsetBang,
  lockBang,
  noneBang,
  isNullRelation,
  readonlyBang,
  strictLoadingBang,
  createWithBang,
  fromBang,
  distinctBang,
  extendingBang,
  optimizerHintsBang,
  reverseOrderBang,
  skipQueryCacheBang,
  skipPreloadingBang,
  annotateBang,
  uniqBang,
  excludingBang,
  constructJoinDependency,
} as const;
