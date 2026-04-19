import { Relation } from "./relation.js";
import type { Base } from "./base.js";

/**
 * Specialized Relation returned by `DisableJoinsAssociationScope`.
 * Operates in one of two modes:
 *
 *   1. **Loaded-chain mode** (Rails' `DisableJoinsAssociationRelation`,
 *      `activerecord/lib/active_record/disable_joins_association_relation.rb`):
 *      constructed with `(klass, key, ids)` after the chain walk is
 *      complete. `toArray()` loads via Relation, then groups by `key`
 *      and re-emits in `ids` order so callers see join-table ordering
 *      (SQL `IN(...)` doesn't preserve list order). `limit` / `first`
 *      slice the loaded array in-memory rather than appending SQL
 *      LIMIT (matches Rails' deliberate deviation).
 *
 *   2. **Deferred-chain mode**: constructed with a `chainWalker`
 *      callback that performs the async chain walk on first `toArray()`
 *      and returns the final scope (which itself may be a loaded-chain
 *      DJAR for the ordered-upstream wrap case). Lets `DJAS.scope()`
 *      return a `Relation` synchronously instead of `Promise<{ relation }>` —
 *      matches Rails' `DisableJoinsAssociationScope#scope` returning
 *      a Relation directly.
 */
export class DisableJoinsAssociationRelation<T extends Base> extends Relation<T> {
  readonly key: string;
  /** Stored IDs (uniq'd at construction). Exposed as `ids()` to match
   * Rails' `attr_reader :ids` which shadows `Relation#ids` here. */
  private readonly _storedIds: unknown[];
  /** Deferred chain walker. Boxed return ({ relation }) defeats
   * `Relation.then` — without the box, `await Promise<Relation>`
   * would unwrap to `T[]` (records array) instead of the Relation
   * itself. The box stays internal; callers see only the public
   * `toArray()` interface. */
  private readonly _chainWalker?: () => Promise<{ relation: Relation<T> }>;
  private _walkerPromise?: Promise<T[]>;

  constructor(
    klass: typeof Base,
    key: string,
    ids: unknown[],
    chainWalker?: () => Promise<{ relation: Relation<T> }>,
  ) {
    super(klass);
    this.key = key;
    this._storedIds = Array.from(new Set(ids));
    this._chainWalker = chainWalker;
  }

  /**
   * Construct a deferred-chain DJAR. Used by `DJAS.scope()` to return
   * a sync Relation while letting the async chain walk happen at
   * `toArray()` time. `key` and `ids` are placeholders here — the
   * walker's returned Relation owns the real reorder semantics (it
   * may itself be a loaded-chain DJAR if upstream was ordered).
   *
   * The walker MUST return a boxed `{ relation }`, not a bare
   * `Promise<Relation>` — bare Relations get unwrapped to `T[]` by
   * Promise's thenable chaining (since `Relation.then` is the
   * `toArray` shortcut). Callers construct the box at the source so
   * the bare Relation never crosses an `await` boundary.
   */
  static deferred<T extends Base>(
    klass: typeof Base,
    chainWalker: () => Promise<{ relation: Relation<T> }>,
  ): DisableJoinsAssociationRelation<T> {
    return new DisableJoinsAssociationRelation<T>(klass, "", [], chainWalker);
  }

  /**
   * Compose any query state chained onto this deferred DJAR (wheres,
   * orders, limit, offset, select, distinct, group, having, joins,
   * lock, etc.) onto the walker's result relation. Without this,
   * `DJAS.scope(...).where(...)` and other chained modifiers would
   * be silently dropped — the walker builds a fresh relation that
   * doesn't see anything stored on `this`.
   *
   * Implementation: always merge `this` as the overlay onto the
   * walker's result. Relation#merge handles wheres/orders/etc;
   * `_rawOrderClauses` (used by `inOrderOf`) and `_isNone` (used by
   * `.none()`) are copied explicitly because Relation#merge doesn't
   * propagate them today.
   */
  private _composeChainedState(walkerResult: Relation<T>): Relation<T> {
    const merged = (walkerResult as unknown as { merge: (o: unknown) => Relation<T> }).merge(this);
    // Explicit copies for state Relation#merge doesn't propagate.
    const overlay = this as unknown as {
      _rawOrderClauses?: unknown[];
      _isNone?: boolean;
    };
    const target = merged as unknown as {
      _rawOrderClauses?: unknown[];
      _isNone?: boolean;
    };
    if ((overlay._rawOrderClauses?.length ?? 0) > 0) {
      target._rawOrderClauses = [
        ...(target._rawOrderClauses ?? []),
        ...(overlay._rawOrderClauses ?? []),
      ];
    }
    if (overlay._isNone) target._isNone = true;
    return merged;
  }

  override async ids(): Promise<unknown[]> {
    if (this._chainWalker) {
      // Deferred mode — delegate to the composed walker result's
      // ids(), which can pluck instead of materializing full records.
      // (If the walker produced a loaded-chain DJAR, that DJAR's
      // ids() returns its stored through-IDs without a query.)
      const { relation } = await this._chainWalker();
      const merged = this._composeChainedState(relation);
      return (merged as unknown as { ids: () => Promise<unknown[]> }).ids();
    }
    return this._storedIds;
  }

  /**
   * Preserve the subclass on `_clone()` (and any chained `where`/`order`
   * /`merge`) so the custom `toArray` reordering and `limit`/`first`
   * overrides survive chaining. Without this, Relation#_clone() would
   * spawn a plain Relation and silently drop the wrapping behavior.
   */
  protected override _newRelation(): Relation<T> {
    return new DisableJoinsAssociationRelation<T>(
      this.model,
      this.key,
      this._storedIds,
      this._chainWalker,
    ) as unknown as Relation<T>;
  }

  override async toArray(): Promise<T[]> {
    if (this._chainWalker) {
      // Memoize the walk + load so repeated toArray() calls don't
      // re-execute the chain (e.g. via Relation thenable shortcuts).
      if (!this._walkerPromise) {
        const walker = this._chainWalker;
        // Snapshot the chained query state from `this` (wheres /
        // orders / limit / etc) so post-chain operations like
        // `DJAS.scope(...).where({title: 'foo'})` actually filter the
        // walker's result. Without this, chained wheres would be
        // silently dropped — _loadThroughViaDisableJoinsScope routes
        // `options.scope(rel)` through here for example.
        const overlay = this;
        this._walkerPromise = (async () => {
          const { relation } = await walker();
          const merged = overlay._composeChainedState(relation);
          return merged.toArray();
        })();
      }
      return this._walkerPromise;
    }
    // Loaded-chain mode: load via Relation, then group by `key` and
    // re-emit in `ids` order so the caller sees join-table ordering
    // (Rails' `load` override).
    const records = await super.toArray();
    const byKey = new Map<unknown, T[]>();
    for (const r of records) {
      const k = r.readAttribute(this.key);
      const bucket = byKey.get(k);
      if (bucket) bucket.push(r);
      else byKey.set(k, [r]);
    }
    const ordered: T[] = [];
    for (const id of this._storedIds) {
      const bucket = byKey.get(id);
      if (bucket) ordered.push(...bucket);
    }
    return ordered;
  }

  /**
   * Loaded-chain mode (Rails fidelity): `def limit(value);
   * records.take(value); end` — load everything then slice in
   * memory. Deferred-chain mode: chain like a normal Relation. The
   * walker result composes the limit via `_composeChainedState` and
   * the underlying relation handles SQL LIMIT (or, if the walker
   * produced a loaded-chain DJAR, that DJAR's own override slices
   * in-memory).
   */
  // @ts-expect-error — deliberate Rails-fidelity deviation in loaded-chain mode: returns Array, not Relation
  override limit(value: number): Relation<T> | Promise<T[]> {
    if (this._chainWalker) return Relation.prototype.limit.call(this, value) as Relation<T>;
    return (async () => {
      const records = await this.toArray();
      return records.slice(0, value);
    })();
  }

  /**
   * Loaded-chain mode: load + take. Deferred-chain mode: chain like
   * a normal Relation (returning a new deferred DJAR with limit
   * applied — async first() on that lands on the SQL-LIMIT path of
   * the walker's underlying relation).
   */
  // @ts-expect-error — deliberate Rails-fidelity deviation in loaded-chain mode: async, not sync
  override first(limit?: number): Promise<T | null> | Promise<T[]> {
    if (this._chainWalker) {
      // Defer to Relation's chained-then-load semantics: spawn a
      // limited(1)/limited(N) clone, then load + take the first.
      const limitVal = limit ?? 1;
      const limited = Relation.prototype.limit.call(this, limitVal) as Relation<T>;
      return (async () => {
        const records = await limited.toArray();
        if (limit === undefined) return records[0] ?? null;
        return records;
      })() as Promise<T | null> | Promise<T[]>;
    }
    return (async () => {
      const records = await this.toArray();
      if (limit === undefined) return records[0] ?? null;
      return records.slice(0, limit);
    })() as Promise<T | null> | Promise<T[]>;
  }
}
