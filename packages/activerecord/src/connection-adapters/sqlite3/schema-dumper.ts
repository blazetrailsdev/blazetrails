/**
 * SQLite3 schema dumper — SQLite-specific schema dump logic.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::SQLite3::SchemaDumper
 */

import { SchemaDumper as AbstractSchemaDumper } from "../abstract/schema-dumper.js";

export class SchemaDumper extends AbstractSchemaDumper {
  defaultPrimaryKeyType(): string {
    return "integer";
  }

  // Mirrors: SQLite3::SchemaDumper#virtual_tables
  protected override async dumpVirtualTables(lines: string[]): Promise<void> {
    const source = (this as any)._source;
    const adapter = source?._adapter;
    if (!adapter || typeof adapter.virtualTables !== "function") return;
    const tables: Record<string, [string, string]> = await adapter.virtualTables();
    const names = Object.keys(tables).sort();
    if (names.length === 0) return;
    lines.push("");
    for (const name of names) {
      const [moduleName, argsStr] = tables[name];
      const args = argsStr.split(/,\s*/).map((a: string) => a.trim());
      lines.push(
        `  await ctx.createVirtualTable(${JSON.stringify(name)}, ${JSON.stringify(moduleName)}, ${JSON.stringify(args)});`,
      );
    }
  }
}
