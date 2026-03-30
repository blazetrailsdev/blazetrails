/**
 * PostgreSQL schema creation — PostgreSQL-specific DDL generation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::SchemaCreation
 */

import { SchemaCreation as AbstractSchemaCreation } from "../abstract/schema-creation.js";

export class SchemaCreation extends AbstractSchemaCreation {
  constructor() {
    super("postgres");
  }

  visitAddForeignKey(fromTable: string, toTable: string, options: Record<string, unknown>): string {
    const column = (options.column as string) ?? `${toTable.replace(/s$/, "")}_id`;
    const primaryKey = (options.primaryKey as string) ?? "id";
    const name = (options.name as string) ?? `fk_rails_${fromTable}_${column}`;

    let sql = `ALTER TABLE "${fromTable}" ADD CONSTRAINT "${name}" `;
    sql += `FOREIGN KEY ("${column}") REFERENCES "${toTable}" ("${primaryKey}")`;

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
