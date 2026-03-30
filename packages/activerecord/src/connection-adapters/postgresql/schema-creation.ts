/**
 * PostgreSQL schema creation — PostgreSQL-specific DDL generation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::SchemaCreation
 */

import { SchemaCreation as AbstractSchemaCreation } from "../abstract/schema-creation.js";
import { quoteIdentifier, quoteTableName } from "../abstract/quoting.js";

export class SchemaCreation extends AbstractSchemaCreation {
  constructor() {
    super("postgres");
  }

  visitAddForeignKey(fromTable: string, toTable: string, options: Record<string, unknown>): string {
    const column = (options.column as string) ?? `${toTable.replace(/s$/, "")}_id`;
    const primaryKey = (options.primaryKey as string) ?? "id";
    const name = (options.name as string) ?? `fk_rails_${fromTable}_${column}`;

    let sql = `ALTER TABLE ${quoteTableName(fromTable, "postgres")} ADD CONSTRAINT ${quoteIdentifier(name, "postgres")} `;
    sql += `FOREIGN KEY (${quoteIdentifier(column, "postgres")}) REFERENCES ${quoteTableName(toTable, "postgres")} (${quoteIdentifier(primaryKey, "postgres")})`;

    if (options.onDelete) {
      sql += ` ON DELETE ${(options.onDelete as string).toUpperCase().replace("_", " ")}`;
    }
    if (options.onUpdate) {
      sql += ` ON UPDATE ${(options.onUpdate as string).toUpperCase().replace("_", " ")}`;
    }
    if (options.validate === false) {
      sql += " NOT VALID";
    }

    return sql;
  }
}
