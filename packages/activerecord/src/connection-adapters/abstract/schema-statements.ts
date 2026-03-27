/**
 * SchemaStatements — DDL operations for database schema manipulation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SchemaStatements
 *
 * This is the base implementation with generic SQL. Adapter-specific
 * subclasses can override methods for dialect differences (e.g. SQLite
 * doesn't support ALTER TABLE ADD CONSTRAINT).
 */

import type { DatabaseAdapter } from "../../adapter.js";
import { TableDefinition, type ColumnType, type ColumnOptions } from "./schema-definitions.js";
import { detectAdapterName } from "../../adapter-name.js";
import { quoteDefaultExpression } from "../../quoting.js";

export class SchemaStatements {
  constructor(
    protected adapter: DatabaseAdapter,
    protected adapterName: "sqlite" | "postgres" | "mysql" = detectAdapterName(adapter),
  ) {}

  async createTable(
    name: string,
    optionsOrFn?:
      | { id?: boolean; force?: boolean; ifNotExists?: boolean }
      | ((t: TableDefinition) => void),
    fn?: (t: TableDefinition) => void,
  ): Promise<void> {
    let options: { id?: boolean; force?: boolean; ifNotExists?: boolean } = {};
    let definer: ((t: TableDefinition) => void) | undefined;

    if (typeof optionsOrFn === "function") {
      definer = optionsOrFn;
    } else if (optionsOrFn) {
      options = optionsOrFn;
      definer = fn;
    }

    if (name.length > 64) {
      throw new Error(`Table name '${name}' is too long; the limit is 64 characters`);
    }

    if (options.force && options.ifNotExists) {
      throw new Error("Options `:force` and `:if_not_exists` cannot be used simultaneously.");
    }

    if (options.force) {
      if (await this.tableExists(name)) {
        await this.dropTable(name);
      }
    }

    if (options.ifNotExists && (await this.tableExists(name))) {
      return;
    }

    const td = new TableDefinition(name, { ...options, adapterName: this.adapterName });
    if (definer) definer(td);

    await this.adapter.executeMutation(td.toSql());

    for (const idx of td.indexes) {
      const indexName = idx.name ?? `index_${name}_on_${idx.columns.join("_and_")}`;
      const unique = idx.unique ? "UNIQUE " : "";
      const cols = idx.columns.map((c) => `"${c}"`).join(", ");
      await this.adapter.executeMutation(
        `CREATE ${unique}INDEX "${indexName}" ON "${name}" (${cols})`,
      );
    }
  }

  async dropTable(name?: string, _options?: { ifExists?: boolean }): Promise<void> {
    await this.adapter.executeMutation(`DROP TABLE IF EXISTS "${name}"`);
  }

  async addColumn(
    tableName: string,
    columnName: string,
    type: ColumnType,
    options: ColumnOptions & { ifNotExists?: boolean } = {},
  ): Promise<void> {
    if (options.ifNotExists && (await this.columnExists(tableName, columnName))) {
      return;
    }
    const sqlType = this._sqlType(type, options);
    const nullable = options.null === false ? " NOT NULL" : "";
    const defaultClause = this._defaultClause(options.default);

    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${sqlType}${nullable}${defaultClause}`,
    );
  }

  async removeColumn(
    tableName: string,
    columnName: string,
    options: { ifExists?: boolean } = {},
  ): Promise<void> {
    if (options.ifExists && !(await this.columnExists(tableName, columnName))) {
      return;
    }
    await this.adapter.executeMutation(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}"`);
  }

  async renameColumn(tableName: string, oldName: string, newName: string): Promise<void> {
    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" RENAME COLUMN "${oldName}" TO "${newName}"`,
    );
  }

  async addIndex(
    tableName: string,
    columns: string | string[],
    options: { unique?: boolean; name?: string } = {},
  ): Promise<void> {
    const cols = Array.isArray(columns) ? columns : [columns];
    const indexName = options.name ?? `index_${tableName}_on_${cols.join("_and_")}`;
    const unique = options.unique ? "UNIQUE " : "";

    await this.adapter.executeMutation(
      `CREATE ${unique}INDEX "${indexName}" ON "${tableName}" (${cols.map((c) => `"${c}"`).join(", ")})`,
    );
  }

  async removeIndex(
    tableName: string,
    options: { column?: string | string[]; name?: string } = {},
  ): Promise<void> {
    let indexName: string;
    if (options.name) {
      indexName = options.name;
    } else if (options.column) {
      const cols = Array.isArray(options.column) ? options.column : [options.column];
      indexName = `index_${tableName}_on_${cols.join("_and_")}`;
    } else {
      throw new Error("Must specify either name or column for remove_index");
    }

    if (this.adapterName === "mysql") {
      await this.adapter.executeMutation(`DROP INDEX \`${indexName}\` ON \`${tableName}\``);
    } else {
      await this.adapter.executeMutation(`DROP INDEX IF EXISTS "${indexName}"`);
    }
  }

  async changeColumn(
    tableName: string,
    columnName: string,
    type: ColumnType,
    options: ColumnOptions = {},
  ): Promise<void> {
    const sqlType = this._sqlType(type, options);
    const nullable = options.null === false ? " NOT NULL" : "";
    const defaultClause = this._defaultClause(options.default);

    if (this.adapterName === "mysql") {
      await this.adapter.executeMutation(
        `ALTER TABLE "${tableName}" MODIFY COLUMN "${columnName}" ${sqlType}${nullable}${defaultClause}`,
      );
    } else {
      await this.adapter.executeMutation(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE ${sqlType}${nullable}${defaultClause}`,
      );
    }
  }

  async renameTable(oldName: string, newName: string): Promise<void> {
    await this.adapter.executeMutation(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
  }

  async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.adapter.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
    );
    return rows.length > 0;
  }

  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const rows = await this.adapter.execute(`PRAGMA table_info("${tableName}")`);
    return rows.some((row: any) => row.name === columnName);
  }

  async changeColumnDefault(
    tableName: string,
    columnName: string,
    options: { from?: unknown; to: unknown } | unknown,
  ): Promise<void> {
    const defaultVal =
      typeof options === "object" && options !== null && "to" in (options as any)
        ? (options as any).to
        : options;
    const clause = this._defaultClause(defaultVal);
    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET${clause || " DEFAULT NULL"}`,
    );
  }

  async changeColumnNull(
    tableName: string,
    columnName: string,
    allowNull: boolean,
    _defaultValue?: unknown,
  ): Promise<void> {
    const constraint = allowNull ? "DROP NOT NULL" : "SET NOT NULL";
    await this.adapter.executeMutation(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" ${constraint}`,
    );
  }

  async addReference(
    tableName: string,
    refName: string,
    options: ColumnOptions & {
      polymorphic?: boolean;
      foreignKey?: boolean;
      type?: ColumnType;
      index?: boolean;
    } = {},
  ): Promise<void> {
    const colType = options.type ?? "integer";
    await this.addColumn(tableName, `${refName}_id`, colType, options);
    if (options.polymorphic) {
      await this.addColumn(tableName, `${refName}_type`, "string", options);
    }
    if (options.index !== false) {
      const cols = options.polymorphic ? [`${refName}_id`, `${refName}_type`] : [`${refName}_id`];
      await this.addIndex(tableName, cols);
    }
  }

  async removeReference(
    tableName: string,
    refName: string,
    options: { polymorphic?: boolean } = {},
  ): Promise<void> {
    if (options.polymorphic) {
      await this.removeColumn(tableName, `${refName}_type`);
    }
    await this.removeColumn(tableName, `${refName}_id`);
  }

  async addForeignKey(
    fromTable: string,
    toTable: string,
    options: { column?: string; primaryKey?: string; name?: string } = {},
  ): Promise<void> {
    const column = options.column ?? `${toTable.replace(/s$/, "")}_id`;
    const pk = options.primaryKey ?? "id";
    const name = options.name ?? `fk_${fromTable}_${column}`;
    await this.adapter.executeMutation(
      `ALTER TABLE "${fromTable}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${toTable}" ("${pk}")`,
    );
  }

  async removeForeignKey(
    fromTable: string,
    toTableOrOptions?: string | { column?: string; name?: string },
  ): Promise<void> {
    let name: string;
    if (typeof toTableOrOptions === "string") {
      const column = `${toTableOrOptions.replace(/s$/, "")}_id`;
      name = `fk_${fromTable}_${column}`;
    } else if (toTableOrOptions?.name) {
      name = toTableOrOptions.name;
    } else if (toTableOrOptions?.column) {
      name = `fk_${fromTable}_${toTableOrOptions.column}`;
    } else {
      throw new Error("removeForeignKey requires a target table or options");
    }
    await this.adapter.executeMutation(`ALTER TABLE "${fromTable}" DROP CONSTRAINT "${name}"`);
  }

  async addTimestamps(tableName: string, options: ColumnOptions = {}): Promise<void> {
    const nullable = options.null !== undefined ? options.null : false;
    await this.addColumn(tableName, "created_at", "datetime", { null: nullable });
    await this.addColumn(tableName, "updated_at", "datetime", { null: nullable });
  }

  async removeTimestamps(tableName: string): Promise<void> {
    await this.removeColumn(tableName, "created_at");
    await this.removeColumn(tableName, "updated_at");
  }

  async createJoinTable(
    table1: string,
    table2: string,
    options?: { tableName?: string } | ((t: TableDefinition) => void),
    fn?: (t: TableDefinition) => void,
  ): Promise<void> {
    let opts: { tableName?: string } = {};
    let definer: ((t: TableDefinition) => void) | undefined;
    if (typeof options === "function") {
      definer = options;
    } else if (options) {
      opts = options;
      definer = fn;
    }
    const tableName = opts.tableName ?? [table1, table2].sort().join("_");
    await this.createTable(tableName, { id: false }, (t) => {
      t.integer(`${table1.replace(/s$/, "")}_id`);
      t.integer(`${table2.replace(/s$/, "")}_id`);
      if (definer) definer(t);
    });
  }

  async dropJoinTable(
    table1: string,
    table2: string,
    options?: { tableName?: string },
  ): Promise<void> {
    const tableName = options?.tableName ?? [table1, table2].sort().join("_");
    await this.dropTable(tableName);
  }

  async renameIndex(_tableName: string, oldName: string, newName: string): Promise<void> {
    await this.adapter.executeMutation(`ALTER INDEX "${oldName}" RENAME TO "${newName}"`);
  }

  indexName(tableName: string, options: { column?: string | string[] }): string {
    const cols = Array.isArray(options.column) ? options.column : [options.column ?? ""];
    return `index_${tableName}_on_${cols.join("_and_")}`;
  }

  async removeColumns(tableName: string, ...columns: string[]): Promise<void> {
    for (const col of columns) {
      await this.removeColumn(tableName, col);
    }
  }

  async addColumns(
    tableName: string,
    ...columns: Array<{ name: string; type: ColumnType; options?: ColumnOptions }>
  ): Promise<void> {
    for (const col of columns) {
      await this.addColumn(tableName, col.name, col.type, col.options ?? {});
    }
  }

  async columns(
    tableName: string,
  ): Promise<Array<{ name: string; type: string; null: boolean; default: unknown }>> {
    const rows = await this.adapter.execute(`PRAGMA table_info("${tableName}")`);
    return rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      null: row.notnull === 0,
      default: row.dflt_value,
    }));
  }

  async indexes(
    tableName: string,
  ): Promise<Array<{ name: string; columns: string[]; unique: boolean }>> {
    const rows = await this.adapter.execute(`PRAGMA index_list("${tableName}")`);
    const result: Array<{ name: string; columns: string[]; unique: boolean }> = [];
    for (const row of rows as any[]) {
      const cols = await this.adapter.execute(`PRAGMA index_info("${row.name}")`);
      result.push({
        name: row.name,
        columns: (cols as any[]).map((c: any) => c.name),
        unique: row.unique === 1,
      });
    }
    return result;
  }

  async primaryKey(tableName: string): Promise<string | null> {
    const rows = await this.adapter.execute(`PRAGMA table_info("${tableName}")`);
    const pk = (rows as any[]).find((r: any) => r.pk > 0);
    return pk ? pk.name : null;
  }

  async foreignKeys(
    tableName: string,
  ): Promise<Array<{ from: string; to: string; column: string; primaryKey: string }>> {
    const rows = await this.adapter.execute(`PRAGMA foreign_key_list("${tableName}")`);
    return (rows as any[]).map((row: any) => ({
      from: tableName,
      to: row.table,
      column: row.from,
      primaryKey: row.to,
    }));
  }

  async tables(): Promise<string[]> {
    const rows = await this.adapter.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    return (rows as any[]).map((r: any) => r.name);
  }

  async views(): Promise<string[]> {
    const rows = await this.adapter.execute(
      `SELECT name FROM sqlite_master WHERE type='view' ORDER BY name`,
    );
    return (rows as any[]).map((r: any) => r.name);
  }

  protected _sqlType(type: ColumnType, options: ColumnOptions): string {
    switch (type) {
      case "string":
        return `VARCHAR(${options.limit ?? 255})`;
      case "text":
        return "TEXT";
      case "integer":
        return "INTEGER";
      case "float":
        return this.adapterName === "postgres" ? "DOUBLE PRECISION" : "REAL";
      case "decimal":
        return `DECIMAL(${options.precision ?? 10}, ${options.scale ?? 0})`;
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "DATE";
      case "datetime":
      case "timestamp":
        return this.adapterName === "postgres" ? "TIMESTAMP" : "DATETIME";
      case "binary":
        return this.adapterName === "postgres" ? "BYTEA" : "BLOB";
      case "json":
        return "JSON";
      case "jsonb":
        return this.adapterName === "postgres" ? "JSONB" : "JSON";
      case "primary_key":
        if (this.adapterName === "postgres") return "SERIAL PRIMARY KEY";
        if (this.adapterName === "mysql") return "INT AUTO_INCREMENT PRIMARY KEY";
        return "INTEGER PRIMARY KEY AUTOINCREMENT";
    }
  }

  protected _defaultClause(defaultValue: unknown): string {
    return quoteDefaultExpression(defaultValue);
  }
}
