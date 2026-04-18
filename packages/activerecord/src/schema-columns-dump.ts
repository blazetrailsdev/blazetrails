/**
 * Emits a `{ table: { column: railsType } }` JSON map from a live
 * adapter. Consumed by `trails-tsc --schema <path>` so the virtualizer
 * can inject `declare` members for schema-only columns.
 *
 * Not in Rails — this is the bridge that gives TypeScript IDE
 * autocomplete parity with Rails' runtime method_missing.
 */

import type { DatabaseAdapter } from "./adapter.js";
import { SchemaStatements } from "./connection-adapters/abstract/schema-statements.js";

export interface DumpSchemaColumnsOptions {
  /**
   * Tables to skip. Always includes `schema_migrations` and
   * `ar_internal_metadata` — those are bookkeeping tables Rails never
   * maps to user models.
   */
  ignoreTables?: readonly string[];
}

const ALWAYS_IGNORED = new Set(["schema_migrations", "ar_internal_metadata"]);

export async function dumpSchemaColumns(
  adapter: DatabaseAdapter,
  options: DumpSchemaColumnsOptions = {},
): Promise<Record<string, Record<string, string>>> {
  const schema = new SchemaStatements(adapter);
  const ignore = new Set([...ALWAYS_IGNORED, ...(options.ignoreTables ?? [])]);

  const tables = (await schema.tables()).filter((t) => !ignore.has(t)).sort();

  const out: Record<string, Record<string, string>> = Object.create(null);
  for (const table of tables) {
    const cols = await schema.columns(table);
    const colMap: Record<string, string> = Object.create(null);
    // Sort columns for stable output.
    const sorted = [...cols].sort((a, b) => a.name.localeCompare(b.name));
    for (const col of sorted) {
      // Prefer the Rails-normalized name from SqlTypeMetadata.type
      // (e.g. "string", "integer", "datetime") — that's the alphabet
      // trails-tsc keys by. `col.type` getter prefers sqlType which
      // can be adapter-specific (e.g. "character varying(255)"), so go
      // directly to the metadata when available.
      const railsType = col.sqlTypeMetadata?.type ?? col.sqlType ?? col.type ?? "value";
      colMap[col.name] = railsType;
    }
    out[table] = colMap;
  }
  return out;
}
