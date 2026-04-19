import {
  AssociationScope,
  ReflectionProxy,
  type AssociationScopeable,
  type ValueTransformation,
} from "./association-scope.js";
import { DisableJoinsAssociationRelation } from "../disable-joins-association-relation.js";
import type { Relation } from "../relation.js";
import type { UnscopeType } from "../relation/query-methods.js";
import type { Base } from "../base.js";
import type { AbstractReflection } from "../reflection.js";

type ChainEntry = AbstractReflection | ReflectionProxy;

/**
 * Normalize a `joinPrimaryKey` / `joinForeignKey` to an array of column
 * names. Both single-column (`"id"`) and composite (`["a", "b"]`)
 * shapes are supported; downstream code branches on `cols.length === 1`
 * vs `> 1` to decide between hash-WHERE (`{key: ids}`) and tuple-IN
 * raw SQL (`(c1, c2) IN ((?, ?), ...)`).
 */
function keyColumns(key: string | string[], label: string): string[] {
  if (Array.isArray(key)) {
    if (key.length === 0) {
      throw new Error(`DisableJoinsAssociationScope: empty ${label}`);
    }
    return key;
  }
  return [key];
}

/**
 * Read multiple owner attributes as a tuple. Single-column case
 * returns `[v]`; composite returns `[v1, v2, ...]` matching the
 * column order. Used to seed the chain-walk's first join-IDs entry.
 */
function readTuple(owner: Base, cols: string[]): unknown[] {
  return cols.map((c) => owner.readAttribute(c));
}

/**
 * Build a tuple-IN WHERE clause as raw SQL: `(c1, c2) IN ((?, ?), ...)`.
 * Returns null when `tuples` is empty (caller should short-circuit
 * with no records). PG / MySQL / SQLite all support tuple IN; Arel's
 * AST doesn't expose a direct constructor for it, so raw SQL is the
 * portable path.
 */
function tupleInClause(cols: string[], tuples: unknown[][]): { sql: string; binds: unknown[] } {
  const placeholderRow = "(" + cols.map(() => "?").join(", ") + ")";
  const allRows = tuples.map(() => placeholderRow).join(", ");
  const colList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
  const flat: unknown[] = [];
  for (const t of tuples) flat.push(...t);
  return { sql: `(${colList}) IN (${allRows})`, binds: flat };
}

/**
 * Builds scopes for `:through` associations that disable joins, querying
 * each step's table separately and stitching results in memory via IN(...)
 * rather than emitting a multi-table JOIN. Used when the source and
 * through models live in separate databases (Rails' `disable_joins: true`).
 *
 * Chain walk (Rails: `disable_joins_association_scope.rb#last_scope_chain`):
 * the chain is reversed; each non-tail step has its constraints applied,
 * then `pluck(next_step.join_foreign_key)` collects IDs that feed the
 * next step's `WHERE join_primary_key IN (...)`. The final step's relation
 * is returned to the caller (or wrapped in a `DisableJoinsAssociationRelation`
 * when the source has no order but an upstream step was ordered).
 *
 * Intermediate `pluck` calls are async in this codebase (Rails' are
 * sync DB calls), so the chain walk itself cannot be synchronous.
 * `scope()` returns a `DisableJoinsAssociationRelation` in deferred-
 * chain mode — a sync `Relation` whose `toArray()` runs the async
 * walk on first load. This matches Rails' `Relation`-returning
 * signature without forcing callers into a `Promise<{ relation }>`
 * boxing dance.
 *
 * Mirrors: ActiveRecord::Associations::DisableJoinsAssociationScope
 */
export class DisableJoinsAssociationScope extends AssociationScope {
  static override readonly INSTANCE: DisableJoinsAssociationScope =
    DisableJoinsAssociationScope.create();

  constructor(valueTransformation: ValueTransformation = (v) => v) {
    super(valueTransformation);
  }

  /**
   * Sync override of `AssociationScope#scope`. Returns a deferred-
   * chain `DisableJoinsAssociationRelation` — the async chain walk
   * runs on first `toArray()`. Matches Rails' `Relation`-returning
   * signature (`DisableJoinsAssociationScope#scope` at
   * disable_joins_association_scope.rb:6-15) without the boxing
   * workaround our async pluck would otherwise force.
   */
  override scope(association: AssociationScopeable): unknown {
    const sourceReflection = association.reflection;
    const owner = association.owner;
    const klass = association.klass;
    // Boxed walker — see `DJAR.deferred` doc. The bare Relation must
    // never cross an `await` boundary, or Promise/A+ unwraps it via
    // the Relation thenable (`.then` → `toArray`). Build sync, box,
    // return the box.
    return DisableJoinsAssociationRelation.deferred(klass, async () => {
      const reverseChain = this._getChain(sourceReflection).slice().reverse();
      const [lastReflection, lastOrdered, lastJoinIds] = await this._lastScopeChain(
        reverseChain,
        owner,
      );
      const key = (lastReflection as { joinPrimaryKey: string | string[] }).joinPrimaryKey;
      const keyCols = keyColumns(key, "joinPrimaryKey");
      const relation = this._addConstraintsDj(
        lastReflection,
        keyCols,
        lastJoinIds,
        owner,
        lastOrdered,
      ) as Relation<Base>;
      return { relation };
    });
  }

  /**
   * Walk the reversed chain, accumulating `[reflection, ordered, joinIds]`.
   * The first item seeds with the owner's join_foreign_key value; each
   * subsequent step builds its scope, plucks the next step's
   * join_foreign_key, and forwards the resulting IDs.
   *
   * Mirrors: DisableJoinsAssociationScope#last_scope_chain (lines 18-31).
   */
  private async _lastScopeChain(
    reverseChain: ChainEntry[],
    owner: Base,
  ): Promise<[ChainEntry, boolean, unknown[]]> {
    const work = reverseChain.slice();
    const firstItem = work.shift();
    if (!firstItem) {
      throw new Error("DisableJoinsAssociationScope: empty chain");
    }
    const firstFk = (firstItem as { joinForeignKey: string | string[] }).joinForeignKey;
    const firstFkCols = keyColumns(firstFk, "joinForeignKey");
    // Single-column shape stays `[v1, v2, ...]` (one value per join
    // candidate). Composite shape becomes `[[v1a, v1b], ...]` (one
    // tuple per join candidate). The owner contributes exactly one
    // tuple as the chain seed.
    const seedTuple = readTuple(owner, firstFkCols);
    const initialIds = firstFkCols.length === 1 ? [seedTuple[0]] : [seedTuple];
    let acc: [ChainEntry, boolean, unknown[]] = [firstItem, false, initialIds];

    for (const nextReflection of work) {
      const [reflection, ordered, joinIds] = acc;
      const key = (reflection as { joinPrimaryKey: string | string[] }).joinPrimaryKey;
      const keyCols = keyColumns(key, "joinPrimaryKey");
      const records = this._addConstraintsDj(reflection, keyCols, joinIds, owner, ordered);
      const foreignKey = (nextReflection as { joinForeignKey: string | string[] }).joinForeignKey;
      const foreignKeyCols = keyColumns(foreignKey, "joinForeignKey");
      // Pluck single column → `[v, v, ...]`; pluck multiple →
      // `[[v1a, v1b], ...]`. Forward as-is into the next iteration.
      const recordIds = (await (
        records as { pluck: (...cols: string[]) => Promise<unknown[]> }
      ).pluck(...foreignKeyCols)) as unknown[];
      // `orderValues` covers `_orderClauses` (the parsed form); raw-SQL
      // orders (e.g. `inOrderOf`) live in `_rawOrderClauses` and are
      // invisible to the public getter. Check both so chain steps with
      // raw orders trigger the DJAR wrapping branch correctly.
      const ord = records as { orderValues?: unknown[]; _rawOrderClauses?: unknown[] };
      const recordsOrdered =
        (ord.orderValues?.length ?? 0) > 0 || (ord._rawOrderClauses?.length ?? 0) > 0;
      acc = [nextReflection, recordsOrdered, recordIds];
    }
    return acc;
  }

  /**
   * Build a per-step scope: `klass.unscoped.where(key IN ids)` merged with
   * `scope_for_association` (minus the joined/eager-load options that
   * would conflict with the disabled-joins shape) and any reflection
   * `constraints()` (where_clause += / order_values |=).
   *
   * If the source step has no ORDER but an upstream step was ordered,
   * wrap in `DisableJoinsAssociationRelation` so loaded records come
   * back in IN-list order.
   *
   * Mirrors: DisableJoinsAssociationScope#add_constraints (lines 33-56).
   */
  private _addConstraintsDj(
    reflection: ChainEntry,
    keyCols: string[],
    joinIds: unknown[],
    owner: Base,
    ordered: boolean,
  ): unknown {
    const klass = (reflection as { klass: typeof Base }).klass;
    let scope: unknown = (klass as unknown as { unscoped: () => unknown }).unscoped();
    if (keyCols.length === 1) {
      // Single-column key: hash WHERE compiles to `key IN (?, ?, ...)`.
      scope = (scope as { where: (c: Record<string, unknown>) => unknown }).where({
        [keyCols[0]]: joinIds,
      });
    } else {
      // Composite key: tuples of values. Empty tuple list ⇒ empty
      // result; short-circuit by emitting a never-true WHERE so the
      // load returns 0 rows without a malformed `() IN ()` SQL.
      const tuples = joinIds as unknown[][];
      if (tuples.length === 0) {
        scope = (scope as { where: (c: Record<string, unknown>) => unknown }).where({
          [keyCols[0]]: null as unknown,
        });
        // The where above doesn't strictly produce zero rows for a
        // nullable column; follow with `.none()` semantics by chaining
        // a literal-false predicate. Fall through to scope_for_assoc /
        // constraints below for parity, then the `none` short-circuit
        // ensures no DB hit at toArray time. Use raw-SQL safety: a
        // `1=0` clause is the universal "no rows" predicate.
        scope = (scope as { where: (sql: string) => unknown }).where("1=0");
      } else {
        const { sql, binds } = tupleInClause(keyCols, tuples);
        scope = (scope as { where: (sql: string, ...binds: unknown[]) => unknown }).where(
          sql,
          ...binds,
        );
      }
    }

    const sfa = (
      klass as unknown as { scopeForAssociation?: () => unknown }
    ).scopeForAssociation?.();
    if (sfa) {
      // Rails: `relation.except(:select, :create_with, :includes, :preload,
      // :eager_load, :joins, :left_outer_joins)` strips those query parts
      // before merging. Our `Relation#except` is the SQL set-operation
      // EXCEPT (Rails-faithful for that name); the query-part strip is
      // `unscope(...)`. The full Rails set is now supported.
      const stripped = (sfa as { unscope: (...keys: UnscopeType[]) => unknown }).unscope(
        "select",
        "createWith",
        "includes",
        "preload",
        "eagerLoad",
        "joins",
        "leftOuterJoins",
      );
      scope = (scope as { merge: (o: unknown) => unknown }).merge(stripped);
    }

    const constraints =
      (
        reflection as { constraints?: () => Array<(...args: unknown[]) => unknown> }
      ).constraints?.() ?? [];
    for (const c of constraints) {
      if (typeof c !== "function") continue;
      const entryScope = this._buildEntryScope(klass);
      const evaluated =
        c.length === 0
          ? (c as () => unknown).call(entryScope)
          : c.call(entryScope, entryScope, owner);
      scope = this._pushScopeIntoRelation(scope, evaluated);
    }

    // Same _rawOrderClauses guard as the chain-walk: a raw-SQL order on
    // the source step also disables the DJAR wrap.
    const finalOrd = scope as { orderValues?: unknown[]; _rawOrderClauses?: unknown[] };
    const finalOrders =
      (finalOrd.orderValues?.length ?? 0) > 0 || (finalOrd._rawOrderClauses?.length ?? 0) > 0
        ? [1]
        : [];
    if (finalOrders.length === 0 && ordered) {
      // DJAR's loaded-chain wrap groups records by `key` (single
      // string) and re-emits in `ids` order. For composite keys this
      // would need tuple grouping (out of scope for this PR — see
      // task #10). Skip the wrap for composite; records still load
      // correctly via the tuple-IN WHERE above, just without the
      // through-table-order reorder. Single-column case keeps the
      // wrap.
      if (keyCols.length === 1) {
        const split = new DisableJoinsAssociationRelation<Base>(klass, keyCols[0], joinIds);
        const sourceWhere = (scope as { _whereClause?: { predicates?: unknown[] } })._whereClause;
        const splitWhere = (split as unknown as { _whereClause?: { predicates: unknown[] } })
          ._whereClause;
        if (sourceWhere?.predicates && splitWhere) {
          splitWhere.predicates.push(...sourceWhere.predicates);
        }
        return split;
      }
    }
    return scope;
  }
}
