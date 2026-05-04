/**
 * PostgreSQL schema dumper — PostgreSQL-specific schema dump logic.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::SchemaDumper
 */

import { SchemaDumper as AbstractSchemaDumper } from "../abstract/schema-dumper.js";
import type { Column } from "./column.js";

export class SchemaDumper extends AbstractSchemaDumper {
  /** @internal */
  protected override prepareColumnOptions(column: Column): Record<string, unknown> {
    const spec = super.prepareColumnOptions(column as any);
    if (column.array) spec["array"] = "true";

    const adapter = this.pgAdapter();
    if (adapter?.supportsVirtualColumns?.() && column.isVirtual()) {
      spec["as"] = this.extractExpressionForVirtualColumn(column);
      spec["stored"] = true;
      // Rails: { type: schema_type(column).inspect } — symbol inspect gives ":bigserial"
      return { type: `:${this.schemaType(column)}`, ...spec };
    }

    if (column.isEnum) spec["enum_type"] = JSON.stringify(column.sqlType);

    return spec;
  }

  /** @internal */
  protected override isDefaultPrimaryKey(column: Column): boolean {
    return this.schemaType(column) === "bigserial";
  }

  /** @internal */
  protected isExplicitPrimaryKeyDefault(column: Column): boolean {
    return column.type === "uuid" || (column.type === "integer" && !column.isSerial);
  }

  /** @internal */
  protected override schemaType(column: Column): string {
    if (column.isSerial) return column.isBigint() ? "bigserial" : "serial";
    // bigint: column.type (SQL type) is "bigint" — super handles it correctly
    if (column.isBigint()) return super.schemaType(column as any);
    // For all other types, use the semantic type from sqlTypeMetadata (e.g. "string"
    // for character varying) rather than column.type (SQL type) to match Rails'
    // column.type which returns the semantic type symbol (:string, :integer, etc.)
    const semantic = (column as any).sqlTypeMetadata?.type as string | undefined;
    return semantic ?? super.schemaType(column as any);
  }

  /** @internal */
  protected override schemaExpression(column: Column): string | undefined {
    if (column.isSerial) return undefined;
    return super.schemaExpression(column as any);
  }

  /** @internal */
  protected extractExpressionForVirtualColumn(column: Column): string {
    return JSON.stringify(column.defaultFunction);
  }

  defaultPrimaryKeyType(): string {
    return "bigserial";
  }

  private pgAdapter(): any {
    const src = (this as any)._source;
    // AdapterSchemaSource wraps the adapter; raw adapter passed directly (e.g. createSchemaDumper)
    return src?.adapter ?? src;
  }
}
