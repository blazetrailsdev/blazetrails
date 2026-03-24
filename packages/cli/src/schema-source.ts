import type { DatabaseAdapter } from "@rails-ts/activerecord";
import type { SchemaSource, ColumnInfo, IndexInfo } from "@rails-ts/activerecord";

/** Escape a SQLite identifier (double internal quotes). */
function sqliteId(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Adapter-backed SchemaSource for use with SchemaDumper.
 * Queries the actual database for table, column, and index info.
 * Supports SQLite and Postgres.
 */
export class AdapterSchemaSource implements SchemaSource {
  constructor(private adapter: DatabaseAdapter) {}

  private get adapterName(): string {
    return this.adapter.constructor.name;
  }

  async tables(): Promise<string[]> {
    if (this.adapterName.includes("Postgres")) {
      const rows = await this.adapter.execute(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );
      return (rows as any[]).map((r: any) => r.tablename);
    }

    if (this.adapterName.includes("Mysql")) {
      throw new Error("MySQL schema introspection is not yet supported by AdapterSchemaSource.");
    }

    // SQLite
    const rows = await this.adapter.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    return (rows as any[]).map((r: any) => r.name);
  }

  async columns(tableName: string): Promise<ColumnInfo[]> {
    if (this.adapterName.includes("Postgres")) {
      const rows = await this.adapter.execute(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
         FROM information_schema.columns
         WHERE table_name = ? AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [tableName],
      );
      const pkRows = await this.adapter.execute(
        `SELECT a.attname FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = ?::regclass AND i.indisprimary`,
        [tableName],
      );
      const pkCols = new Set((pkRows as any[]).map((r: any) => r.attname));

      return (rows as any[]).map((r: any) => ({
        name: r.column_name,
        type: r.data_type,
        primaryKey: pkCols.has(r.column_name),
        null: r.is_nullable === "YES",
        default: r.column_default,
        limit: r.character_maximum_length ?? undefined,
        precision: r.numeric_precision ?? undefined,
        scale: r.numeric_scale ?? undefined,
      }));
    }

    // SQLite (PRAGMA doesn't support bind params, so escape the identifier)
    const rows = await this.adapter.execute(`PRAGMA table_info(${sqliteId(tableName)})`);
    return (rows as any[]).map((r: any) => ({
      name: r.name,
      type: r.type,
      primaryKey: r.pk > 0,
      null: r.notnull === 0,
      default: r.dflt_value,
    }));
  }

  async indexes(tableName: string): Promise<IndexInfo[]> {
    if (this.adapterName.includes("Postgres")) {
      const rows = await this.adapter.execute(
        `SELECT i.relname AS name, ix.indisunique AS unique,
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
         FROM pg_class t
         JOIN pg_index ix ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
         WHERE t.relname = ? AND NOT ix.indisprimary
         GROUP BY i.relname, ix.indisunique`,
        [tableName],
      );
      return (rows as any[]).map((r: any) => ({
        columns: Array.isArray(r.columns) ? r.columns : [r.columns],
        unique: r.unique,
        name: r.name,
      }));
    }

    // SQLite
    const rows = await this.adapter.execute(`PRAGMA index_list(${sqliteId(tableName)})`);
    const result: IndexInfo[] = [];
    for (const row of rows as any[]) {
      if ((row.name as string).startsWith("sqlite_")) continue;
      const cols = await this.adapter.execute(`PRAGMA index_info(${sqliteId(row.name)})`);
      result.push({
        columns: (cols as any[]).map((c: any) => c.name),
        unique: row.unique === 1,
        name: row.name,
      });
    }
    return result;
  }
}
