import type { Base } from "../base.js";
import type { AssociationReflection, AbstractReflection } from "../reflection.js";
import { isStiSubclass, getStiBase, getInheritanceColumn, descendants } from "../inheritance.js";

/**
 * Lambda applied to each FK/type bind value before it reaches the
 * generated WHERE. Rails uses this to let STI base_class / polymorphic
 * name rewriting flow through the same scope-building path as ordinary
 * attribute reads.
 */
export type ValueTransformation<T = unknown> = (v: T) => unknown;

/**
 * Minimum shape `AssociationScope.scope` needs from its argument. Rails
 * passes a concrete `Association` instance (see
 * `activerecord/lib/active_record/associations/association.rb`); we
 * duck-type so the internal loader paths in `associations.ts` — which
 * don't always have an Association wrapper — can use the same code.
 */
export interface AssociationScopeable {
  readonly owner: Base;
  readonly reflection: AssociationReflection;
  readonly klass: typeof Base;
}

/**
 * Proxy wrapping a reflection with the aliased table that AssociationScope
 * computes when walking `reflection.chain`. For chain length 1 the
 * aliased table is just `reflection.klass.arelTable`; non-trivial chains
 * (added in a later PR) ask `AliasTracker#aliasedTableFor` for a unique
 * alias via `reflection.aliasCandidate(name)`.
 *
 * Mirrors: ActiveRecord::Associations::AssociationScope::ReflectionProxy
 * (association_scope.rb:101-110 in Rails 8.0.2 — SimpleDelegator wrapping
 * a reflection plus `attr_reader :aliased_table` and
 * `def all_includes; nil; end`.)
 */
export class ReflectionProxy {
  readonly reflection: AssociationReflection;
  readonly aliasedTable: unknown;

  constructor(reflection: AssociationReflection, aliasedTable: unknown) {
    this.reflection = reflection;
    this.aliasedTable = aliasedTable;
  }

  /**
   * Block-form opt-out Rails uses to skip eager-load propagation through
   * the chain. We mirror the sentinel (return `null`) — callers in later
   * PRs check for non-null to decide whether to merge `includes_values`.
   */
  allIncludes<T>(_cb?: () => T): T | null {
    return null;
  }

  // SimpleDelegator-style forwarding of the attributes AssociationScope
  // reads. Kept explicit instead of a runtime Proxy so TypeScript sees
  // the shape.
  get joinPrimaryKey(): string | string[] {
    return this.reflection.joinPrimaryKey;
  }

  get joinForeignKey(): string | string[] {
    return this.reflection.joinForeignKey;
  }

  get type(): string | null {
    return this.reflection.type;
  }

  get klass(): typeof Base {
    return this.reflection.klass;
  }

  get name(): string {
    return this.reflection.name;
  }

  get scope(): ((rel: unknown) => unknown) | undefined {
    return (this.reflection as unknown as { scope?: (rel: unknown) => unknown }).scope;
  }

  constraints(): Array<(...args: unknown[]) => unknown> {
    return this.reflection.constraints() as Array<(...args: unknown[]) => unknown>;
  }
}

/**
 * Builds the scope (query) for an association based on its reflection.
 *
 * Rails implementation (activerecord/lib/active_record/associations/association_scope.rb):
 *   - `self.scope(association)` → `INSTANCE.scope(association)`
 *   - `self.create(&block)` → `new(block ||= identity)`
 *   - `INSTANCE = create` (identity transformation)
 *
 * PR 1 scope: chain length 1 (non-through). PRs 2+ add polymorphic
 * `as:`, multi-step through chains, and `DisableJoinsAssociationScope`.
 *
 * Mirrors: ActiveRecord::Associations::AssociationScope
 */
export class AssociationScope {
  private readonly _valueTransformation: ValueTransformation;

  constructor(valueTransformation: ValueTransformation) {
    this._valueTransformation = valueTransformation;
  }

  static create(valueTransformation?: ValueTransformation): AssociationScope {
    return new AssociationScope(valueTransformation ?? ((v: unknown) => v));
  }

  /** Identity-lambda shared instance. Rails: `INSTANCE = create`. */
  static readonly INSTANCE: AssociationScope = AssociationScope.create();

  /**
   * Entry point. Build the Relation that loads (or filters) the given
   * association's records for its owner.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope.scope
   */
  static scope(association: AssociationScopeable): unknown {
    return AssociationScope.INSTANCE.scope(association);
  }

  /**
   * Collect the bind values consumed by the chain — in chain order.
   * For chain length 1 this is `[owner[joinForeignKey], owner.class.name?]`.
   * For multi-step chains, intermediate reflections contribute the
   * polymorphic type of the NEXT reflection's klass so JOINs filter by
   * STI base class correctly.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope.get_bind_values
   * (association_scope.rb:34-49).
   */
  static getBindValues(
    owner: Base,
    chain: ReadonlyArray<AbstractReflection | ReflectionProxy>,
  ): unknown[] {
    const binds: unknown[] = [];
    const last = chain[chain.length - 1];
    if (!last) return binds;
    const joinFk = (last as { joinForeignKey?: string | string[] }).joinForeignKey;
    const fks = Array.isArray(joinFk) ? joinFk : joinFk ? [joinFk] : [];
    for (const fk of fks) binds.push(owner.readAttribute(fk));
    if ((last as { type?: string | null }).type) {
      binds.push((owner.constructor as typeof Base).name);
    }
    for (let i = 0; i < chain.length - 1; i++) {
      const refl = chain[i];
      const next = chain[i + 1];
      if ((refl as { type?: string | null }).type) {
        binds.push((next as { klass?: { name: string } }).klass?.name ?? null);
      }
    }
    return binds;
  }

  /**
   * Build the association's relation for `association.owner`. The
   * returned value is an unexecuted `Relation` (so callers can chain
   * `.where`/`.order`/`.toArray`).
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#scope
   * (association_scope.rb:21-32).
   */
  scope(association: AssociationScopeable): unknown {
    const { owner, reflection, klass } = association;
    // Rails: `klass.unscoped` (association_scope.rb:23). Rails' unscoped
    // bypasses default_scope but STILL applies the STI `type_condition`
    // because `relation()` adds it for `finder_needs_type_condition?`
    // classes (`core.rb:431-435`). Our `Base.unscoped` doesn't wire STI
    // through `relation()` yet, so we re-add the type condition here.
    let scope: unknown = klass.unscoped();
    if (isStiSubclass(klass)) {
      const col = getInheritanceColumn(getStiBase(klass));
      if (col) {
        const stiNames = [klass.name, ...descendants(klass).map((d: typeof Base) => d.name)];
        scope = (scope as { where: (c: Record<string, unknown>) => unknown }).where({
          [col]: stiNames.length === 1 ? stiNames[0] : stiNames,
        });
      }
    }
    const chain = this._getChain(reflection);
    scope = this._addConstraints(scope, owner, chain);
    if (!reflection.isCollection()) {
      scope = (scope as { limit: (n: number) => unknown }).limit(1);
    }
    return scope;
  }

  private _transformValue<T>(value: T): unknown {
    return this._valueTransformation(value);
  }

  /**
   * Rails checks `scope.table == table` and scopes the where to the
   * joined table's alias in the multi-step case. For chain length 1
   * `scope.table` is the klass table, so the where goes directly on the
   * relation.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#apply_scope
   * (association_scope.rb:161-167).
   */
  private _applyScope(scope: unknown, _table: unknown, key: string, value: unknown): unknown {
    return (scope as { where: (c: Record<string, unknown>) => unknown }).where({
      [key]: value,
    });
  }

  /**
   * For the LAST reflection in the chain (which for chain-1 is the only
   * one), apply owner-FK WHERE clauses plus the polymorphic `_type`
   * filter if the reflection is polymorphic.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#last_chain_scope
   * (association_scope.rb:58-75).
   */
  private _lastChainScope(
    scope: unknown,
    reflection: AbstractReflection | ReflectionProxy,
    owner: Base,
  ): unknown {
    const r = reflection as {
      joinPrimaryKey: string | string[];
      joinForeignKey: string | string[];
      type?: string | null;
    };
    const table = (reflection as ReflectionProxy).aliasedTable ?? null;
    const joinPks = Array.isArray(r.joinPrimaryKey) ? r.joinPrimaryKey : [r.joinPrimaryKey];
    const joinFks = Array.isArray(r.joinForeignKey) ? r.joinForeignKey : [r.joinForeignKey];
    for (let i = 0; i < joinPks.length; i++) {
      const rawValue = owner.readAttribute(joinFks[i]);
      const value = this._transformValue(rawValue);
      scope = this._applyScope(scope, table, joinPks[i], value);
    }
    if (r.type) {
      const polyName = this._transformValue((owner.constructor as typeof Base).name);
      scope = this._applyScope(scope, table, r.type, polyName);
    }
    return scope;
  }

  /**
   * Build the chain of reflections to walk. Rails uses `reflection.chain`
   * and wraps all-but-head in `ReflectionProxy` with aliased tables; for
   * chain length 1 the source reflection stands alone.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#get_chain
   * (association_scope.rb:112-122). Multi-step wrapping comes in PR 3.
   */
  private _getChain(
    reflection: AssociationReflection,
  ): Array<AbstractReflection | ReflectionProxy> {
    if (reflection.chain.length > 1) {
      throw new Error(
        `AssociationScope: multi-step chain (through) not implemented in PR 1 — ` +
          `reflection '${reflection.name}' has ${reflection.chain.length} chain entries`,
      );
    }
    return [reflection];
  }

  /**
   * Fold `last_chain_scope` over the chain and merge any user-supplied
   * `scope` lambdas (reflection.scope / reflection.constraints) into the
   * relation. PR 1 applies the scope lambda on the tail only.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#add_constraints
   * (association_scope.rb:124-159).
   */
  private _addConstraints(
    scope: unknown,
    owner: Base,
    chain: Array<AbstractReflection | ReflectionProxy>,
  ): unknown {
    const last = chain[chain.length - 1];
    scope = this._lastChainScope(scope, last, owner);
    const scopeLambda = (last as { scope?: (rel: unknown) => unknown }).scope;
    if (typeof scopeLambda === "function") {
      const applied = scopeLambda(scope);
      if (applied) scope = applied;
    }
    return scope;
  }
}
