import type { Base } from "./base.js";
import { Table, Nodes, sql as arelSql } from "@blazetrails/arel";
import { pluralize, underscore } from "@blazetrails/activesupport";
import { isStiSubclass, getStiBase } from "./inheritance.js";
import { quoteIdentifier, quoteTableName } from "./connection-adapters/abstract/quoting.js";
import { detectAdapterName } from "./adapter-name.js";

/**
 * Schema metadata for ActiveRecord models — table name, primary key,
 * columns, content columns, SQL helpers, and table creation.
 *
 * Mirrors: ActiveRecord::ModelSchema
 */

// ---------------------------------------------------------------------------
// Table name resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the table name for a model class.
 * Inferred from class name if not explicitly set. STI subclasses
 * inherit the base class's table name.
 *
 * Mirrors: ActiveRecord::ModelSchema::ClassMethods#table_name
 */
export function resolveTableName(modelClass: typeof Base): string {
  if ((modelClass as any)._tableName) return (modelClass as any)._tableName;
  if (isStiSubclass(modelClass)) {
    return resolveTableName(getStiBase(modelClass));
  }
  const prefix = (modelClass as any)._tableNamePrefix ?? "";
  const suffix = (modelClass as any)._tableNameSuffix ?? "";
  const inferred = pluralize(underscore(modelClass.name));
  return `${prefix}${inferred}${suffix}`;
}

// ---------------------------------------------------------------------------
// Primary key helpers
// ---------------------------------------------------------------------------

/**
 * Quote a single value for use in SQL.
 */
export function quoteValue(val: unknown): string {
  if (val === null) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Build a WHERE clause string for the primary key of a given record.
 *
 * Mirrors: used throughout ActiveRecord persistence internals
 */
export function buildPkWhere(modelClass: typeof Base, idValue: unknown): string {
  const pk = modelClass.primaryKey;
  if (Array.isArray(pk)) {
    const values = idValue as unknown[];
    return pk.map((col, i) => `"${col}" = ${quoteValue(values[i])}`).join(" AND ");
  }
  return `"${pk}" = ${quoteValue(idValue)}`;
}

/**
 * Build an Arel node for a primary key WHERE condition.
 *
 * Mirrors: used with Arel managers for type-safe SQL generation
 */
export function buildPkWhereNode(
  modelClass: typeof Base,
  idValue: unknown,
): InstanceType<typeof Nodes.Node> {
  const table = new Table(resolveTableName(modelClass));
  const pk = modelClass.primaryKey;
  if (Array.isArray(pk)) {
    if (!Array.isArray(idValue)) return arelSql("1=0");
    const values = idValue;
    const conditions = pk.map((col, i) => {
      const attr = table.get(col);
      const v = values[i];
      if (v === undefined || v === null) return arelSql("1=0");
      return attr.eq(v);
    });
    return new Nodes.And(conditions);
  }
  const attr = table.get(pk as string);
  if (idValue === undefined || idValue === null) return arelSql("1=0");
  return attr.eq(idValue);
}

// ---------------------------------------------------------------------------
// Column introspection
// ---------------------------------------------------------------------------

/**
 * Return column names for a model, excluding ignored columns.
 *
 * Mirrors: ActiveRecord::ModelSchema::ClassMethods#column_names
 */
export function columnNames(modelClass: typeof Base): string[] {
  const ignored = new Set(modelClass.ignoredColumns ?? []);
  return Array.from(modelClass._attributeDefinitions.keys()).filter((name) => !ignored.has(name));
}

/**
 * Check if a model class has a given attribute defined.
 *
 * Mirrors: ActiveRecord::ModelSchema::ClassMethods#has_attribute?
 */
export function hasAttributeDefinition(modelClass: typeof Base, name: string): boolean {
  return modelClass._attributeDefinitions.has(name);
}

/**
 * Return a hash of column definitions keyed by name.
 *
 * Mirrors: ActiveRecord::ModelSchema::ClassMethods#columns_hash
 */
export function columnsHash(
  modelClass: typeof Base,
): Record<string, { name: string; type: string; default: unknown }> {
  if (modelClass.abstractClass) {
    throw new Error(`Cannot call columnsHash on abstract class ${modelClass.name}`);
  }
  const result: Record<string, { name: string; type: string; default: unknown }> = {};
  for (const [name, def] of modelClass._attributeDefinitions) {
    result[name] = { name, type: def.type.name, default: def.defaultValue };
  }
  return result;
}

/**
 * Return content columns (excluding PK, FKs, and timestamps).
 *
 * Mirrors: ActiveRecord::ModelSchema::ClassMethods#content_columns
 */
export function contentColumns(modelClass: typeof Base): string[] {
  const pk = modelClass.primaryKey;
  return columnNames(modelClass).filter((col) => {
    if (col === pk) return false;
    if (col.endsWith("_id")) return false;
    if (col === "created_at" || col === "updated_at") return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// SQL type mapping
// ---------------------------------------------------------------------------

/**
 * Map ActiveModel type names to SQL column types.
 */
export function sqlTypeFor(typeName: string): string {
  switch (typeName) {
    case "integer":
    case "big_integer":
      return "INTEGER";
    case "float":
    case "decimal":
      return "REAL";
    case "boolean":
      return "INTEGER";
    case "binary":
      return "BLOB";
    default:
      return "TEXT";
  }
}

// ---------------------------------------------------------------------------
// Table creation (test/development helper)
// ---------------------------------------------------------------------------

/**
 * Create the database table for a model from its attribute definitions.
 * Drops the table first if it already exists.
 *
 * This is a test/development helper — in production, use migrations.
 *
 * Mirrors: used by test infrastructure, not a direct Rails API
 */
export async function createTable(modelClass: typeof Base): Promise<void> {
  const table = resolveTableName(modelClass);
  const pks = Array.isArray(modelClass.primaryKey)
    ? modelClass.primaryKey
    : [modelClass.primaryKey];
  const adapterName = detectAdapterName(modelClass.adapter);
  const isMysql = adapterName === "mysql";
  const isPg = adapterName === "postgres";
  const pkSet = new Set(pks);

  await modelClass.adapter.executeMutation(
    `DROP TABLE IF EXISTS ${quoteTableName(table, adapterName)}`,
  );

  const colDefs: string[] = [];
  if (pks.length === 1) {
    const pk = pks[0];
    const pkDef = isPg
      ? `${quoteIdentifier(pk, adapterName)} SERIAL PRIMARY KEY`
      : isMysql
        ? `${quoteIdentifier(pk, adapterName)} BIGINT AUTO_INCREMENT PRIMARY KEY`
        : `${quoteIdentifier(pk, adapterName)} INTEGER PRIMARY KEY AUTOINCREMENT`;
    colDefs.push(pkDef);
  } else {
    for (const pk of pks) {
      const pkDef = modelClass._attributeDefinitions.get(pk);
      const pkType = pkDef ? sqlTypeFor(pkDef.type?.name || "integer") : "INTEGER";
      colDefs.push(`${quoteIdentifier(pk, adapterName)} ${pkType} NOT NULL`);
    }
  }

  for (const [name, def] of modelClass._attributeDefinitions) {
    if (pkSet.has(name)) continue;
    const sqlType = sqlTypeFor(def.type?.name || "string");
    colDefs.push(`${quoteIdentifier(name, adapterName)} ${sqlType}`);
  }

  if (pks.length > 1) {
    colDefs.push(`PRIMARY KEY (${pks.map((pk) => quoteIdentifier(pk, adapterName)).join(", ")})`);
  }

  await modelClass.adapter.executeMutation(
    `CREATE TABLE IF NOT EXISTS ${quoteTableName(table, adapterName)} (${colDefs.join(", ")})`,
  );
}
