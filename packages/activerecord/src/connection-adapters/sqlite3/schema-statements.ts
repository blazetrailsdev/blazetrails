/**
 * SQLite3 schema statements — SQLite-specific DDL operations.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::SchemaStatements
 *
 * addForeignKey, removeForeignKey, checkConstraints, addCheckConstraint,
 * and removeCheckConstraint are implemented on SQLite3Adapter directly
 * (via alterTable rebuild). The functions below delegate to the adapter.
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
  options?: Record<string, unknown>,
): Promise<void> {
  return (adapter as any).addForeignKey(fromTable, toTable, options);
}

export async function removeForeignKey(
  adapter: DatabaseAdapter,
  fromTable: string,
  toTableOrOptions?: string | Record<string, unknown>,
): Promise<void> {
  return (adapter as any).removeForeignKey(fromTable, toTableOrOptions);
}

export async function checkConstraints(
  adapter: DatabaseAdapter,
  tableName: string,
): Promise<CheckConstraintDefinition[]> {
  return (adapter as any).checkConstraints(tableName);
}

export async function addCheckConstraint(
  adapter: DatabaseAdapter,
  tableName: string,
  expression: string,
  options?: Record<string, unknown>,
): Promise<void> {
  return (adapter as any).addCheckConstraint(tableName, expression, options);
}

export async function removeCheckConstraint(
  adapter: DatabaseAdapter,
  tableName: string,
  expressionOrOptions?: string | Record<string, unknown>,
): Promise<void> {
  return (adapter as any).removeCheckConstraint(tableName, expressionOrOptions);
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

export function createSchemaDumper(
  source: unknown,
  options: Record<string, unknown> = {},
): AbstractSchemaDumper {
  return SchemaDumper.create(source as Parameters<typeof SchemaDumper.create>[0], options);
}

export function schemaCreation(): SchemaCreation {
  return new SchemaCreation("sqlite");
}
