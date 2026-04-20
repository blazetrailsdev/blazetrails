import type { DatabaseAdapter } from "./adapter.js";
import { Current } from "./migration.js";

/**
 * Schema — programmatically defines a database schema using the same
 * DSL as migrations (createTable, addIndex, addColumn, dropTable, etc.).
 *
 * Mirrors: ActiveRecord::Schema — in Rails this is
 * `class Schema < Migration::Current`, so Schema inherits every
 * schema-manipulation method from Migration. Pairing with Rails here
 * means we don't duplicate a second, shallower `createTable` in this
 * file; `Schema.define(adapter, fn)` hands the block a Schema instance
 * that already exposes Migration's full DSL.
 *
 * Usage:
 *
 *   await Schema.define(adapter, async (schema) => {
 *     await schema.createTable("users", (t) => {
 *       t.string("name");
 *     });
 *     await schema.addIndex("users", "name");
 *   });
 */
export class Schema extends Current {
  /**
   * Mirrors: ActiveRecord::Schema.define — the class-method entry
   * point that creates a Schema instance and yields it to the block.
   */
  static async define(
    adapter: DatabaseAdapter,
    fn: (schema: Schema) => void | Promise<void>,
  ): Promise<void> {
    const schema = new Schema(adapter);
    await fn(schema);
  }

  constructor(adapter: DatabaseAdapter) {
    super();
    this.adapter = adapter;
  }
}

/**
 * Mirrors: ActiveRecord::Schema::Definition
 */
export interface Definition {
  define(adapter: DatabaseAdapter, fn: (schema: Schema) => void | Promise<void>): Promise<void>;
}
