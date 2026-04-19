import {
  AssociationScope,
  ReflectionProxy,
  type AssociationScopeable,
  type ValueTransformation,
} from "./association-scope.js";
import { DisableJoinsAssociationRelation } from "../disable-joins-association-relation.js";
import type { Base } from "../base.js";
import type { AbstractReflection } from "../reflection.js";

type ChainEntry = AbstractReflection | ReflectionProxy;

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
 * Because intermediate `pluck` calls must be async in this codebase, this
 * subclass' `scope()` returns a `Promise<Relation>` rather than the
 * synchronous `Relation` Rails returns. Routing in `associations.ts`
 * awaits the promise before driving the final query.
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
   * Async override of `AssociationScope#scope`. Walks the reverse chain,
   * executing intermediate `pluck`s, and returns the final unexecuted
   * relation (regular `Relation` or `DisableJoinsAssociationRelation`).
   *
   * Mirrors: DisableJoinsAssociationScope#scope (lines 6-15 of
   * disable_joins_association_scope.rb).
   */
  override async scope(association: AssociationScopeable): Promise<unknown> {
    const sourceReflection = association.reflection;
    const owner = association.owner;
    const reverseChain = this._getChain(sourceReflection).slice().reverse();

    const [lastReflection, lastOrdered, lastJoinIds] = await this._lastScopeChain(
      reverseChain,
      owner,
    );

    const key = (lastReflection as { joinPrimaryKey: string | string[] }).joinPrimaryKey;
    const keyStr = Array.isArray(key) ? key[0] : key;
    const relation = this._addConstraintsDj(
      lastReflection,
      keyStr,
      lastJoinIds,
      owner,
      lastOrdered,
    );
    // Box the Relation so awaiting the Promise<{relation}> doesn't trip
    // the Relation's thenable (Relation.then → records array). Callers
    // read `.relation` off the resolved value.
    return { relation };
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
    const firstFkStr = Array.isArray(firstFk) ? firstFk[0] : firstFk;
    let acc: [ChainEntry, boolean, unknown[]] = [
      firstItem,
      false,
      [owner.readAttribute(firstFkStr)],
    ];

    for (const nextReflection of work) {
      const [reflection, ordered, joinIds] = acc;
      const key = (reflection as { joinPrimaryKey: string | string[] }).joinPrimaryKey;
      const keyStr = Array.isArray(key) ? key[0] : key;
      const records = this._addConstraintsDj(reflection, keyStr, joinIds, owner, ordered);
      const foreignKey = (nextReflection as { joinForeignKey: string | string[] }).joinForeignKey;
      const foreignKeyStr = Array.isArray(foreignKey) ? foreignKey[0] : foreignKey;
      const recordIds = (await (records as { pluck: (col: string) => Promise<unknown[]> }).pluck(
        foreignKeyStr,
      )) as unknown[];
      const orderValues =
        (records as { _orderClauses?: unknown[] })._orderClauses ?? ([] as unknown[]);
      const recordsOrdered = orderValues.length > 0;
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
    key: string,
    joinIds: unknown[],
    owner: Base,
    ordered: boolean,
  ): unknown {
    const klass = (reflection as { klass: typeof Base }).klass;
    let scope: unknown = (klass as unknown as { unscoped: () => unknown }).unscoped();
    scope = (scope as { where: (c: Record<string, unknown>) => unknown }).where({ [key]: joinIds });

    const sfa = (
      klass as unknown as { scopeForAssociation?: () => unknown }
    ).scopeForAssociation?.();
    if (sfa) {
      const stripped = (
        sfa as {
          except: (...keys: string[]) => unknown;
        }
      ).except(
        "select",
        "create_with",
        "includes",
        "preload",
        "eager_load",
        "joins",
        "left_outer_joins",
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

    const finalOrders = (scope as { _orderClauses?: unknown[] })._orderClauses ?? [];
    if (finalOrders.length === 0 && ordered) {
      const split = new DisableJoinsAssociationRelation<Base>(klass, key, joinIds);
      const sourceWhere = (scope as { _whereClause?: { predicates?: unknown[] } })._whereClause;
      const splitWhere = (split as unknown as { _whereClause?: { predicates: unknown[] } })
        ._whereClause;
      if (sourceWhere?.predicates && splitWhere) {
        splitWhere.predicates.push(...sourceWhere.predicates);
      }
      return split;
    }
    return scope;
  }
}
