/**
 * SQLite3 schema statements — SQLite-specific DDL operations.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::SchemaStatements
 */

import type { DatabaseAdapter } from "../../adapter.js";
import type { CheckConstraintDefinition } from "../abstract/schema-definitions.js";
import { SchemaCreation } from "./schema-creation.js";
import { SchemaDumper as AbstractSchemaDumper } from "../abstract/schema-dumper.js";
import { SchemaDumper } from "./schema-dumper.js";

export interface SchemaStatements {
  dataSources(): Promise<string[]>;
  tables(): Promise<string[]>;
  views(): Promise<string[]>;
  indexes(tableName: string): Promise<unknown[]>;
  primaryKeys(tableName: string): Promise<string[]>;
  foreignKeys(tableName: string): Promise<unknown[]>;
}

export async function addForeignKey(
  adapter: DatabaseAdapter,
  fromTable: string,
  toTable: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  if (options.deferrable) {
    throw new Error("SQLite3 does not support deferrable foreign key constraints");
  }
  // SQLite doesn't support ALTER TABLE ADD CONSTRAINT for FKs.
  // The FK must be added by rebuilding the table (via alter_table).
  // For now, throw to indicate the limitation.
  throw new Error(
    "SQLite3 does not support adding foreign keys via ALTER TABLE. " +
      "Define foreign keys in the CREATE TABLE statement instead.",
  );
}

export async function removeForeignKey(
  adapter: DatabaseAdapter,
  fromTable: string,
  toTableOrOptions?: string | Record<string, unknown>,
): Promise<void> {
  throw new Error(
    "SQLite3 does not support removing foreign keys via ALTER TABLE. " +
      "Rebuild the table without the foreign key instead.",
  );
}

export async function isVirtualTableExists(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<boolean> {
  const rows = await adapter.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? AND sql LIKE '%VIRTUAL%'`,
    [tableName],
  );
  return rows.length > 0;
}

export async function checkConstraints(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<CheckConstraintDefinition[]> {
  const rows = await adapter.execute(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  if (rows.length === 0) return [];
  const sql = String((rows[0] as Record<string, unknown>).sql ?? "");

  const constraints: CheckConstraintDefinition[] = [];
  const checkRegex = /CONSTRAINT\s+"?(\w+)"?\s+CHECK\s*\((.+?)\)(?:\s*,|\s*\))/gi;
  let match;
  while ((match = checkRegex.exec(sql)) !== null) {
    const { CheckConstraintDefinition: ChkDef } = await import("../abstract/schema-definitions.js");
    constraints.push(new ChkDef(tableName, match[2].trim(), match[1], true));
  }

  const anonRegex = /CHECK\s*\((.+?)\)(?:\s*,|\s*\))/gi;
  while ((match = anonRegex.exec(sql)) !== null) {
    if (!constraints.some((c) => c.expression === match![1].trim())) {
      const { CheckConstraintDefinition: ChkDef } =
        await import("../abstract/schema-definitions.js");
      constraints.push(
        new ChkDef(tableName, match[1].trim(), `chk_${tableName}_${constraints.length}`, true),
      );
    }
  }

  return constraints;
}

export async function addCheckConstraint(
  adapter: DatabaseAdapter,
  tableName: string,
  expression: string,
  _options: Record<string, unknown> = {},
): Promise<void> {
  throw new Error(
    "SQLite3 does not support adding CHECK constraints via ALTER TABLE. " +
      "Rebuild the table with the constraint instead.",
  );
}

export async function removeCheckConstraint(
  adapter: DatabaseAdapter,
  tableName: string,
  _expressionOrOptions?: string | Record<string, unknown>,
): Promise<void> {
  throw new Error(
    "SQLite3 does not support removing CHECK constraints via ALTER TABLE. " +
      "Rebuild the table without the constraint instead.",
  );
}

export function createSchemaDumper(
  source: unknown,
  options: Record<string, unknown> = {},
): AbstractSchemaDumper {
  return SchemaDumper.create(source as any, options);
}

export function schemaCreation(): SchemaCreation {
  return new SchemaCreation("sqlite");
}
