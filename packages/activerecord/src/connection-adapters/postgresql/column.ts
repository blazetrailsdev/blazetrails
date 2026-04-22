/**
 * PostgreSQL column — PostgreSQL-specific column metadata.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::Column
 */

import { Column as BaseColumn } from "../column.js";
import { SqlTypeMetadata } from "../sql-type-metadata.js";

export class Column extends BaseColumn {
  readonly serial: boolean;
  readonly oid: number | null;
  readonly fmod: number | null;
  readonly array: boolean;
  readonly identity: string | null;
  readonly generated: string | null;
  readonly enum: boolean;

  constructor(
    name: string,
    defaultValue: unknown,
    sqlTypeMetadata: { sqlType?: string | null; type?: string; oid?: number; fmod?: number } = {},
    null_: boolean = true,
    options: {
      collation?: string | null;
      defaultFunction?: string | null;
      primaryKey?: boolean;
      serial?: boolean;
      array?: boolean;
      identity?: string | null;
      generated?: string | null;
      enum?: boolean;
    } = {},
  ) {
    const meta = new SqlTypeMetadata({
      sqlType: sqlTypeMetadata.sqlType ?? undefined,
      type: sqlTypeMetadata.type,
    });
    super(name, defaultValue, meta, null_, {
      collation: options.collation,
      defaultFunction: options.defaultFunction,
      primaryKey: options.primaryKey,
    });
    this.serial = options.serial ?? false;
    this.oid = sqlTypeMetadata.oid ?? null;
    this.fmod = sqlTypeMetadata.fmod ?? null;
    this.array = options.array ?? this.sqlType?.endsWith("[]") ?? false;
    this.identity = options.identity ?? null;
    this.generated = options.generated ?? null;
    this.enum = options.enum ?? false;
  }

  // Mirrors: Column#sql_type — strips array suffix, returning base type name
  override get sqlType(): string | null {
    const raw = super.sqlType;
    return raw?.endsWith("[]") ? raw.slice(0, -2) : (raw ?? null);
  }

  override get type(): string {
    return this.sqlType ?? "";
  }

  get isSerial(): boolean {
    return (
      this.serial ||
      (typeof this.defaultFunction === "string" && this.defaultFunction.startsWith("nextval("))
    );
  }

  // Mirrors: Column#identity?
  get isIdentity(): boolean {
    return this.identity !== null && this.identity !== "";
  }

  // Mirrors: Column#auto_incremented_by_db?
  override isAutoIncrementedByDb(): boolean {
    return this.isSerial || this.isIdentity;
  }

  // Mirrors: Column#virtual?
  override isVirtual(): boolean {
    return this.generated !== null && this.generated !== "";
  }

  // Mirrors: Column#has_default? — identity columns always have an implicit default; virtual columns have none
  override get hasDefault(): boolean {
    return super.hasDefault && !this.isVirtual();
  }

  // Mirrors: Column#enum?
  get isEnum(): boolean {
    return this.enum;
  }
}
