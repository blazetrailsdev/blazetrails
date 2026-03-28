/**
 * BatchEnumerator — iterates over a relation in batches.
 *
 * Currently loads the full result set then slices into batches.
 * Incremental fetching (LIMIT/OFFSET per batch) is a future optimization.
 *
 * Mirrors: ActiveRecord::Batches::BatchEnumerator
 */

export class BatchEnumerator<T> {
  private _relation: { toArray(): Promise<T[]> };
  readonly ofSize: number;

  constructor(relation: { toArray(): Promise<T[]> }, ofSize: number = 1000) {
    if (ofSize < 1) {
      throw new Error("Batch size must be a positive integer");
    }
    this._relation = relation;
    this.ofSize = ofSize;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T[]> {
    const all = await this._relation.toArray();
    for (let i = 0; i < all.length; i += this.ofSize) {
      yield all.slice(i, i + this.ofSize);
    }
  }

  async each(fn: (batch: T[]) => void | Promise<void>): Promise<void> {
    for await (const batch of this) {
      await fn(batch);
    }
  }
}
