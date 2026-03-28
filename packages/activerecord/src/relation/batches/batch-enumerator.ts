/**
 * BatchEnumerator — iterates over a relation in batches.
 *
 * Used by findEach/findInBatches to process large result sets
 * without loading everything into memory at once.
 *
 * Mirrors: ActiveRecord::Batches::BatchEnumerator
 */

export class BatchEnumerator<T> {
  private _relation: { toArray(): Promise<T[]> };
  readonly ofSize: number;

  constructor(relation: { toArray(): Promise<T[]> }, ofSize: number = 1000) {
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
