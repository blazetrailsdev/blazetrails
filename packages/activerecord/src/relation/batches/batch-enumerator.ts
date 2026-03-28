/**
 * BatchEnumerator — wraps in_batches to provide batch-level operations.
 *
 * Returned by Relation#inBatches(). Each yielded item is a scoped
 * Relation for that batch, enabling operations like deleteAll/updateAll
 * per batch without loading records.
 *
 * Mirrors: ActiveRecord::Batches::BatchEnumerator
 */

export class BatchEnumerator<T> {
  private _generator: () => AsyncGenerator<T>;
  readonly ofSize: number;

  constructor(generator: () => AsyncGenerator<T>, ofSize: number) {
    if (!Number.isInteger(ofSize) || ofSize < 1) {
      throw new Error("Batch size must be a positive integer");
    }
    this._generator = generator;
    this.ofSize = ofSize;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    yield* this._generator();
  }

  async eachBatch(fn: (batch: T) => void | Promise<void>): Promise<void> {
    for await (const batch of this) {
      await fn(batch);
    }
  }

  async eachRecord(fn: (record: any) => void | Promise<void>): Promise<void> {
    for await (const batchRelation of this) {
      const records = await (batchRelation as any).toArray();
      for (const record of records) {
        await fn(record);
      }
    }
  }

  async deleteAll(): Promise<number> {
    let total = 0;
    for await (const batchRelation of this) {
      total += await (batchRelation as any).deleteAll();
    }
    return total;
  }

  async updateAll(updates: Record<string, unknown>): Promise<number> {
    let total = 0;
    for await (const batchRelation of this) {
      total += await (batchRelation as any).updateAll(updates);
    }
    return total;
  }

  async destroyAll(): Promise<any[]> {
    const destroyed: any[] = [];
    for await (const batchRelation of this) {
      const records = await (batchRelation as any).destroyAll();
      destroyed.push(...records);
    }
    return destroyed;
  }
}
