import type { DatabaseAdapter } from "./adapter.js";
import { TableDefinition } from "./connection-adapters/abstract/schema-definitions.js";

/** Detect adapter type from an adapter instance. */
function detectAdapterName(
  adapter: DatabaseAdapter | null | undefined,
): "sqlite" | "postgres" | "mysql" {
  const name = adapter?.constructor?.name ?? "";
  if (name.includes("Postgres") || name === "SchemaAdapter") {
    if (process.env.PG_TEST_URL) return "postgres";
    if (process.env.MYSQL_TEST_URL) return "mysql";
    return "sqlite";
  }
  if (name.includes("Mysql") || name.includes("Maria")) return "mysql";
  return "sqlite";
}

/**
 * Schema — defines database schema declaratively.
 *
 * Mirrors: ActiveRecord::Schema
 */
export class Schema {
  static async define(
    adapter: DatabaseAdapter,
    fn: (schema: Schema) => Promise<void>,
  ): Promise<void> {
    const schema = new Schema(adapter);
    await fn(schema);
  }

  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  private get _adapterName(): "sqlite" | "postgres" | "mysql" {
    return detectAdapterName(this.adapter);
  }

  async createTable(name: string, fn?: (t: TableDefinition) => void): Promise<void> {
    const td = new TableDefinition(name, { adapterName: this._adapterName });
    if (fn) fn(td);
    await this.adapter.executeMutation(td.toSql());
  }
}
