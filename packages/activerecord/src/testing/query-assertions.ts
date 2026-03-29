/**
 * Query assertions — test helpers for asserting SQL query behavior.
 *
 * Mirrors: ActiveRecord::Assertions::QueryAssertions
 */

/**
 * Mirrors: ActiveRecord::Assertions::QueryAssertions::SQLCounter
 *
 * Counts SQL queries executed during a block for assertion purposes.
 */
export class SQLCounter {
  private _queries: string[] = [];
  private _listening = false;

  get queries(): readonly string[] {
    return this._queries;
  }

  get count(): number {
    return this._queries.length;
  }

  record(sql: string): void {
    if (this._listening) {
      this._queries.push(sql);
    }
  }

  start(): void {
    this._queries = [];
    this._listening = true;
  }

  stop(): void {
    this._listening = false;
  }

  reset(): void {
    this._queries = [];
  }
}

/**
 * Mirrors: ActiveRecord::Assertions::QueryAssertions
 */
export interface QueryAssertions {
  assertQueries(expected: number, fn: () => Promise<void>): Promise<void>;
  assertNoQueries(fn: () => Promise<void>): Promise<void>;
}

/**
 * Mirrors: ActiveRecord::Assertions
 */
export interface Assertions {
  queryAssertions: QueryAssertions;
}

/**
 * Assert that exactly `expected` queries are executed during `fn`.
 */
export async function assertQueries(
  counter: SQLCounter,
  expected: number,
  fn: () => void | Promise<void>,
): Promise<void> {
  counter.start();
  try {
    await fn();
  } finally {
    counter.stop();
  }
  if (counter.count !== expected) {
    throw new Error(
      `Expected ${expected} queries, but got ${counter.count}:\n${counter.queries.join("\n")}`,
    );
  }
}

/**
 * Assert that no queries are executed during `fn`.
 */
export async function assertNoQueries(
  counter: SQLCounter,
  fn: () => void | Promise<void>,
): Promise<void> {
  await assertQueries(counter, 0, fn);
}
