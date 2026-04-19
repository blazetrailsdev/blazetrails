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

  override async ids(): Promise<unknown[]> {
    if (this._chainWalker) {
      // Deferred mode — load via the walker, then read PKs off the
      // result. Matches Rails' `Relation#ids` semantics for the
      // deferred-chain path; the loaded-chain mode uses the stored
      // through-IDs instead.
      const records = await this.toArray();
      const pk = this.model.primaryKey as string;
      return records.map((r) => r.readAttribute(pk));
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
        this._walkerPromise = (async () => {
          const { relation } = await this._chainWalker!();
          return relation.toArray();
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
   * Rails: `def limit(value); records.take(value); end` — load everything
   * then slice in memory. Returns an array, breaking the Relation chain
   * (matching Rails' deliberate deviation here).
   */
  // @ts-expect-error — deliberate Rails-fidelity deviation: returns Array, not Relation
  override async limit(value: number): Promise<T[]> {
    const records = await this.toArray();
    return records.slice(0, value);
  }

  /**
   * Rails: load everything then take the first (or first n) in memory,
   * for the same reason as `limit` above.
   */
  // @ts-expect-error — deliberate Rails-fidelity deviation: async, not sync
  override async first(limit?: number): Promise<T | T[] | null> {
    const records = await this.toArray();
    if (limit === undefined) return records[0] ?? null;
    return records.slice(0, limit);
  }
}
