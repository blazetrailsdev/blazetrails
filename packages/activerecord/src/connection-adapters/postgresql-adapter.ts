/**
 * PostgreSQL adapter — connection adapter for PostgreSQL databases.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQLAdapter
 *
 * Re-exports the main adapter and provides StatementPool and MoneyDecoder
 * classes expected by the Rails API surface.
 */

export { PostgreSQLAdapter } from "../adapters/postgresql-adapter.js";

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQLAdapter::StatementPool
 */
export class StatementPool {
  private statements: Map<string, string> = new Map();
  readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get length(): number {
    return this.statements.size;
  }

  get(key: string): string | undefined {
    return this.statements.get(key);
  }

  set(key: string, value: string): void {
    if (this.statements.size >= this.maxSize) {
      const firstKey = this.statements.keys().next().value;
      if (firstKey !== undefined) {
        this.statements.delete(firstKey);
      }
    }
    this.statements.set(key, value);
  }

  delete(key: string): boolean {
    return this.statements.delete(key);
  }

  clear(): void {
    this.statements.clear();
  }

  has(key: string): boolean {
    return this.statements.has(key);
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQLAdapter::MoneyDecoder
 */
export class MoneyDecoder {
  static decode(value: string): number {
    const cleaned = value.replace(/[$,\s()]/g, "");
    const negative = value.includes("(") || value.startsWith("-");
    const num = parseFloat(cleaned);
    return negative && num > 0 ? -num : num;
  }
}
