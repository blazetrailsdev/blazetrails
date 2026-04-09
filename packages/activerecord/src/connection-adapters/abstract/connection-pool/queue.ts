/**
 * Connection pool queue — manages waiting for available connections.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionPool::Queue
 */

import type { DatabaseAdapter } from "../../../adapter.js";

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionPool::BiasableQueue::BiasedConditionVariable
 *
 * In Rails this is a condition variable that preferentially wakes a biased thread.
 * In TS (single-threaded), we model the same API using Promise-based waiters.
 * The `otherCond` and `preferredThread` params exist for API parity but the
 * bias behavior is a no-op in a single-threaded environment.
 */
export class BiasedConditionVariable {
  private _waiters: Array<(conn: DatabaseAdapter) => void> = [];
  private _otherCond: BiasedConditionVariable | null;
  private _numWaitingOnRealCond = 0;

  constructor(
    _lock?: unknown,
    otherCond?: BiasedConditionVariable | null,
    _preferredThread?: unknown,
  ) {
    this._otherCond = otherCond ?? null;
  }

  get waitingCount(): number {
    return this._waiters.length;
  }

  wait(timeout: number): Promise<DatabaseAdapter> {
    return new Promise((resolve, reject) => {
      const state = { timer: 0 as unknown as ReturnType<typeof setTimeout> };

      const waiter = (conn: DatabaseAdapter) => {
        clearTimeout(state.timer);
        const idx = this._waiters.indexOf(waiter);
        if (idx >= 0) this._waiters.splice(idx, 1);
        resolve(conn);
      };

      state.timer = setTimeout(() => {
        const idx = this._waiters.indexOf(waiter);
        if (idx >= 0) this._waiters.splice(idx, 1);
        reject(new Error("Connection pool timeout"));
      }, timeout * 1000);

      this._waiters.push(waiter);
    });
  }

  signal(conn: DatabaseAdapter): boolean {
    const waiter = this._waiters.shift();
    if (waiter) {
      waiter(conn);
      return true;
    }
    return false;
  }

  broadcast(connections: DatabaseAdapter[]): void {
    this.broadcastOnBiased(connections);
    if (this._otherCond) {
      this._otherCond.broadcast(connections);
    }
  }

  broadcastOnBiased(connections: DatabaseAdapter[]): void {
    this._numWaitingOnRealCond = 0;
    for (const conn of connections) {
      if (!this.signal(conn)) break;
    }
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionPool::BiasableQueue
 *
 * In Rails this is a module included into ConnectionLeasingQueue that adds
 * `with_a_bias_for(thread)` to temporarily bias the queue's condition variable
 * toward a specific thread. In TS (single-threaded), we implement the API
 * for parity; the bias is effectively a no-op.
 */
export class BiasableQueue {
  static BiasedConditionVariable = BiasedConditionVariable;

  /** @internal — subclass must provide */
  protected _cond!: BiasedConditionVariable;

  withABiasFor<T>(context: unknown, fn: () => T): T {
    const previousCond = this._cond;
    const newCond = new BiasedConditionVariable(undefined, this._cond, context);
    this._cond = newCond;
    try {
      return fn();
    } finally {
      this._cond = previousCond;
      // wake up any remaining sleepers on the biased cond
      newCond.broadcastOnBiased([]);
    }
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionPool::Queue
 */
export class Queue {
  private _queue: DatabaseAdapter[] = [];
  protected _cond: BiasedConditionVariable;
  private _numWaiting = 0;

  constructor(lock?: unknown) {
    this._cond = new BiasedConditionVariable(lock);
  }

  get length(): number {
    return this._queue.length;
  }

  get waitingCount(): number {
    return this._cond.waitingCount;
  }

  isAnyWaiting(): boolean {
    return this._numWaiting > 0;
  }

  numWaiting(): number {
    return this._numWaiting;
  }

  get any(): boolean {
    return this._queue.length > 0;
  }

  add(conn: DatabaseAdapter): void {
    this._queue.push(conn);
    this._cond.signal(conn);
  }

  delete(element: DatabaseAdapter): DatabaseAdapter | undefined {
    const idx = this._queue.indexOf(element);
    if (idx >= 0) {
      this._queue.splice(idx, 1);
      return element;
    }
    return undefined;
  }

  remove(conn: DatabaseAdapter): boolean {
    const idx = this._queue.indexOf(conn);
    if (idx >= 0) {
      this._queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  poll(timeout?: number): Promise<DatabaseAdapter> | DatabaseAdapter | undefined {
    const conn = this.noWaitPoll();
    if (conn) return conn;
    if (timeout != null) return this.waitPoll(timeout);
    return undefined;
  }

  clear(): DatabaseAdapter[] {
    const items = [...this._queue];
    this._queue = [];
    return items;
  }

  private canRemoveNoWait(): boolean {
    return this._queue.length > this._numWaiting;
  }

  private noWaitPoll(): DatabaseAdapter | undefined {
    if (this.canRemoveNoWait()) {
      return this._queue.pop();
    }
    return undefined;
  }

  private waitPoll(timeout: number): Promise<DatabaseAdapter> {
    this._numWaiting++;
    return this._cond.wait(timeout).finally(() => {
      this._numWaiting--;
    });
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::ConnectionPool::ConnectionLeasingQueue
 */
export class ConnectionLeasingQueue extends Queue {
  private _leasedTo = new Map<DatabaseAdapter, string>();

  withABiasFor<T>(context: unknown, fn: () => T): T {
    return BiasableQueue.prototype.withABiasFor.call(this, context, fn) as T;
  }

  leaseTo(conn: DatabaseAdapter, key: string): void {
    this._leasedTo.set(conn, key);
  }

  unlease(conn: DatabaseAdapter): void {
    this._leasedTo.delete(conn);
  }

  leasedTo(conn: DatabaseAdapter): string | undefined {
    return this._leasedTo.get(conn);
  }
}
