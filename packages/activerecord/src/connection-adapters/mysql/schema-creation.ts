/**
 * MySQL schema creation — MySQL-specific DDL generation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::MySQL::SchemaCreation
 */

import { SchemaCreation as AbstractSchemaCreation } from "../abstract/schema-creation.js";
import type { ReferentialAction } from "../abstract/schema-definitions.js";
import { quoteColumnName, quoteTableName } from "./quoting.js";

export class SchemaCreation extends AbstractSchemaCreation {
  constructor() {
    super("mysql");
  }

  visitAddForeignKey(fromTable: string, toTable: string, options: Record<string, unknown>): string {
    const column = (options.column as string) ?? `${toTable.replace(/s$/, "")}_id`;
    const primaryKey = (options.primaryKey as string) ?? "id";
    const name = (options.name as string) ?? `fk_rails_${fromTable}_${column}`;

    let sql = `ALTER TABLE ${quoteTableName(fromTable)} ADD CONSTRAINT ${quoteColumnName(name)} `;
    sql += `FOREIGN KEY (${quoteColumnName(column)}) REFERENCES ${quoteTableName(toTable)} (${quoteColumnName(primaryKey)})`;

    if (options.onDelete) {
      sql += ` ${this.actionSql("DELETE", options.onDelete as ReferentialAction)}`;
    }
    if (options.onUpdate) {
      sql += ` ${this.actionSql("UPDATE", options.onUpdate as ReferentialAction)}`;
    }

    return sql;
  }
}
