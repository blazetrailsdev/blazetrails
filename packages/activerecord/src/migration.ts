import type { DatabaseAdapter } from "./adapter.js";

/**
 * Column type mapping.
 */
export type ColumnType =
  | "string"
  | "text"
  | "integer"
  | "float"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "timestamp"
  | "binary"
  | "primary_key";

interface ColumnDefinition {
  name: string;
  type: ColumnType;
  options: ColumnOptions;
}

export interface ColumnOptions {
  null?: boolean;
  default?: unknown;
  limit?: number;
  precision?: number;
  scale?: number;
  index?: boolean;
  unique?: boolean;
  primaryKey?: boolean;
}

interface IndexDefinition {
  columns: string[];
  unique: boolean;
  name?: string;
}

/**
 * TableDefinition — used inside create_table blocks.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::TableDefinition
 */
export class TableDefinition {
  readonly tableName: string;
  readonly columns: ColumnDefinition[] = [];
  readonly indexes: IndexDefinition[] = [];
  private _id: boolean;

  constructor(tableName: string, options: { id?: boolean } = {}) {
    this.tableName = tableName;
    this._id = options.id !== false;

    if (this._id) {
      this.columns.push({
        name: "id",
        type: "primary_key",
        options: { primaryKey: true },
      });
    }
  }

  string(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "string", options });
    return this;
  }

  text(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "text", options });
    return this;
  }

  integer(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "integer", options });
    return this;
  }

  float(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "float", options });
    return this;
  }

  decimal(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "decimal", options });
    return this;
  }

  boolean(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "boolean", options });
    return this;
  }

  date(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "date", options });
    return this;
  }

  datetime(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "datetime", options });
    return this;
  }

  timestamp(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "timestamp", options });
    return this;
  }

  binary(name: string, options: ColumnOptions = {}): this {
    this.columns.push({ name, type: "binary", options });
    return this;
  }

  timestamps(): this {
    this.datetime("created_at", { null: false });
    this.datetime("updated_at", { null: false });
    return this;
  }

  references(
    name: string,
    options: ColumnOptions & {
      polymorphic?: boolean;
      foreignKey?: boolean;
    } = {}
  ): this {
    this.integer(`${name}_id`, options);
    if (options.polymorphic) {
      this.string(`${name}_type`, options);
    }
    if (options.index !== false) {
      this.index([`${name}_id`]);
    }
    return this;
  }

  index(
    columns: string[],
    options: { unique?: boolean; name?: string } = {}
  ): this {
    this.indexes.push({
      columns,
      unique: options.unique ?? false,
      name: options.name,
    });
    return this;
  }

  /**
   * Generate CREATE TABLE SQL.
   */
  toSql(): string {
    const columnDefs = this.columns.map((col) => {
      const parts = [`"${col.name}"`];

      switch (col.type) {
        case "primary_key":
          parts.push("INTEGER PRIMARY KEY AUTOINCREMENT");
          break;
        case "string":
          parts.push(`VARCHAR(${col.options.limit ?? 255})`);
          break;
        case "text":
          parts.push("TEXT");
          break;
        case "integer":
          parts.push("INTEGER");
          break;
        case "float":
          parts.push("REAL");
          break;
        case "decimal":
          parts.push(
            `DECIMAL(${col.options.precision ?? 10}, ${col.options.scale ?? 0})`
          );
          break;
        case "boolean":
          parts.push("BOOLEAN");
          break;
        case "date":
          parts.push("DATE");
          break;
        case "datetime":
        case "timestamp":
          parts.push("DATETIME");
          break;
        case "binary":
          parts.push("BLOB");
          break;
      }

      if (col.options.null === false && col.type !== "primary_key") {
        parts.push("NOT NULL");
      }

      if (col.options.default !== undefined) {
        const def = col.options.default;
        if (def === null) {
          parts.push("DEFAULT NULL");
        } else if (typeof def === "boolean") {
          parts.push(`DEFAULT ${def ? "TRUE" : "FALSE"}`);
        } else if (typeof def === "number") {
          parts.push(`DEFAULT ${def}`);
        } else {
          parts.push(`DEFAULT '${String(def).replace(/'/g, "''")}'`);
        }
      }

      return parts.join(" ");
    });

    return `CREATE TABLE "${this.tableName}" (${columnDefs.join(", ")})`;
  }
}

interface RecordedOperation {
  method: string;
  args: unknown[];
}

/**
 * Migration — base class for database migrations.
 *
 * Mirrors: ActiveRecord::Migration
 */
export abstract class Migration {
  protected adapter!: DatabaseAdapter;
  private _recording = false;
  private _recordedOps: RecordedOperation[] = [];

  /**
   * Override to define the forward migration.
   */
  async up(): Promise<void> {
    // Default: run change() in forward direction
    await this._runChange("up");
  }

  /**
   * Override to define the rollback migration.
   * Default: run change() in reverse direction.
   */
  async down(): Promise<void> {
    await this._runChange("down");
  }

  /**
   * Override for reversible migrations.
   * Called by both up() and down() with a direction parameter.
   */
  async change(): Promise<void> {
    // Subclasses override
  }

  private async _runChange(direction: "up" | "down"): Promise<void> {
    if (direction === "up") {
      await this.change();
    } else {
      // Record operations from change(), then replay in reverse
      this._recording = true;
      this._recordedOps = [];
      await this.change();
      this._recording = false;

      // If no operations were recorded, migration is irreversible
      if (this._recordedOps.length === 0) {
        throw new Error(
          `${this.constructor.name}#down is not implemented. This migration is irreversible.`
        );
      }

      // Replay in reverse
      for (const op of this._recordedOps.reverse()) {
        await this._reverseOperation(op);
      }
    }
  }

  private async _reverseOperation(op: RecordedOperation): Promise<void> {
    switch (op.method) {
      case "createTable":
        await this.dropTable(op.args[0] as string);
        break;
      case "dropTable":
        throw new Error("Cannot reverse dropTable without table definition");
      case "addColumn":
        await this.removeColumn(op.args[0] as string, op.args[1] as string);
        break;
      case "removeColumn":
        throw new Error("Cannot reverse removeColumn without type info");
      case "addIndex":
        await this.removeIndex(op.args[0] as string, {
          column: op.args[1] as string | string[],
        });
        break;
      case "removeIndex":
        throw new Error("Cannot reverse removeIndex without column info");
      case "renameColumn":
        await this.renameColumn(
          op.args[0] as string,
          op.args[2] as string,
          op.args[1] as string
        );
        break;
      default:
        throw new Error(`Cannot reverse operation: ${op.method}`);
    }
  }

  /**
   * Create a table.
   *
   * Mirrors: ActiveRecord::Migration#create_table
   */
  async createTable(
    name: string,
    optionsOrFn?:
      | { id?: boolean }
      | ((t: TableDefinition) => void),
    fn?: (t: TableDefinition) => void
  ): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "createTable", args: [name, optionsOrFn, fn] });
      return;
    }
    let options: { id?: boolean } = {};
    let definer: ((t: TableDefinition) => void) | undefined;

    if (typeof optionsOrFn === "function") {
      definer = optionsOrFn;
    } else if (optionsOrFn) {
      options = optionsOrFn;
      definer = fn;
    }

    const td = new TableDefinition(name, options);
    if (definer) definer(td);

    await this.adapter.executeMutation(td.toSql());

    // Create indexes
    for (const idx of td.indexes) {
      const indexName =
        idx.name ?? `index_${name}_on_${idx.columns.join("_")}`;
      const unique = idx.unique ? "UNIQUE " : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      await this.adapter.executeMutation(
        `CREATE ${unique}INDEX "${indexName}" ON "${name}" (${cols})`
      );
    }
  }

  /**
   * Drop a table.
   *
   * Mirrors: ActiveRecord::Migration#drop_table
   */
  async dropTable(name: string): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "dropTable", args: [name] });
      return;
    }
    await this.adapter.executeMutation(`DROP TABLE IF EXISTS "${name}"`);
  }

  /**
   * Add a column to a table.
   *
   * Mirrors: ActiveRecord::Migration#add_column
   */
  async addColumn(
    tableName: string,
    columnName: string,
    type: ColumnType,
    options: ColumnOptions = {}
  ): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "addColumn", args: [tableName, columnName, type, options] });
      return;
    }
    const sqlType = this._sqlType(type, options);
    const nullable =
      options.null === false ? " NOT NULL" : "";
    const defaultClause = this._defaultClause(options.default);

    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${sqlType}${nullable}${defaultClause}`
    );
  }

  /**
   * Remove a column from a table.
   *
   * Mirrors: ActiveRecord::Migration#remove_column
   */
  async removeColumn(tableName: string, columnName: string): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "removeColumn", args: [tableName, columnName] });
      return;
    }
    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`
    );
  }

  /**
   * Rename a column.
   *
   * Mirrors: ActiveRecord::Migration#rename_column
   */
  async renameColumn(
    tableName: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "renameColumn", args: [tableName, oldName, newName] });
      return;
    }
    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" RENAME COLUMN "${oldName}" TO "${newName}"`
    );
  }

  /**
   * Add an index.
   *
   * Mirrors: ActiveRecord::Migration#add_index
   */
  async addIndex(
    tableName: string,
    columns: string | string[],
    options: { unique?: boolean; name?: string } = {}
  ): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "addIndex", args: [tableName, columns, options] });
      return;
    }
    const cols = Array.isArray(columns) ? columns : [columns];
    const indexName =
      options.name ?? `index_${tableName}_on_${cols.join("_")}`;
    const unique = options.unique ? "UNIQUE " : "";

    await this.adapter.executeMutation(
      `CREATE ${unique}INDEX "${indexName}" ON "${tableName}" (${cols.map((c) => `"${c}"`).join(", ")})`
    );
  }

  /**
   * Remove an index.
   *
   * Mirrors: ActiveRecord::Migration#remove_index
   */
  async removeIndex(
    tableName: string,
    options: { column?: string | string[]; name?: string }
  ): Promise<void> {
    if (this._recording) {
      this._recordedOps.push({ method: "removeIndex", args: [tableName, options] });
      return;
    }
    let indexName: string;
    if (options.name) {
      indexName = options.name;
    } else if (options.column) {
      const cols = Array.isArray(options.column)
        ? options.column
        : [options.column];
      indexName = `index_${tableName}_on_${cols.join("_")}`;
    } else {
      throw new Error("Must specify either name or column for remove_index");
    }

    await this.adapter.executeMutation(`DROP INDEX IF EXISTS "${indexName}"`);
  }

  /**
   * Execute the migration on a given adapter.
   */
  async run(adapter: DatabaseAdapter, direction: "up" | "down" = "up"): Promise<void> {
    this.adapter = adapter;
    if (direction === "up") {
      await this.up();
    } else {
      await this.down();
    }
  }

  /**
   * Get the migration version from the class name or a static property.
   */
  get version(): string {
    return (this.constructor as any).version ?? this.constructor.name;
  }

  private _sqlType(type: ColumnType, options: ColumnOptions): string {
    switch (type) {
      case "string":
        return `VARCHAR(${options.limit ?? 255})`;
      case "text":
        return "TEXT";
      case "integer":
        return "INTEGER";
      case "float":
        return "REAL";
      case "decimal":
        return `DECIMAL(${options.precision ?? 10}, ${options.scale ?? 0})`;
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "DATE";
      case "datetime":
      case "timestamp":
        return "DATETIME";
      case "binary":
        return "BLOB";
      case "primary_key":
        return "INTEGER PRIMARY KEY AUTOINCREMENT";
    }
  }

  private _defaultClause(defaultValue: unknown): string {
    if (defaultValue === undefined) return "";
    if (defaultValue === null) return " DEFAULT NULL";
    if (typeof defaultValue === "boolean")
      return ` DEFAULT ${defaultValue ? "TRUE" : "FALSE"}`;
    if (typeof defaultValue === "number") return ` DEFAULT ${defaultValue}`;
    return ` DEFAULT '${String(defaultValue).replace(/'/g, "''")}'`;
  }
}

/**
 * Schema — for defining schema in a single block.
 *
 * Mirrors: ActiveRecord::Schema.define
 */
export class Schema {
  static async define(
    adapter: DatabaseAdapter,
    fn: (schema: Schema) => Promise<void>
  ): Promise<void> {
    const schema = new Schema(adapter);
    await fn(schema);
  }

  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  async createTable(
    name: string,
    fn?: (t: TableDefinition) => void
  ): Promise<void> {
    const td = new TableDefinition(name);
    if (fn) fn(td);
    await this.adapter.executeMutation(td.toSql());
  }
}
