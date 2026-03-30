/**
 * PostgreSQL schema definitions — PostgreSQL-specific table/column definitions.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::TableDefinition,
 *          ActiveRecord::ConnectionAdapters::PostgreSQL::Table,
 *          ActiveRecord::ConnectionAdapters::PostgreSQL::AlterTable,
 *          ActiveRecord::ConnectionAdapters::PostgreSQL::ColumnMethods,
 *          ActiveRecord::ConnectionAdapters::PostgreSQL (top-level module)
 */

import {
  TableDefinition as AbstractTableDefinition,
  ColumnDefinition,
  Table as AbstractTable,
  AlterTable as AbstractAlterTable,
} from "../abstract/schema-definitions.js";
import type {
  ColumnOptions,
  ColumnType,
  SchemaStatementsLike,
} from "../abstract/schema-definitions.js";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PostgreSQL {
  export const ADAPTER_NAME = "postgresql" as const;
}

export interface ColumnMethods {
  bigserial(name: string, options?: ColumnOptions): unknown;
  bit(name: string, options?: ColumnOptions & { limit?: number }): unknown;
  bitVarying(name: string, options?: ColumnOptions & { limit?: number }): unknown;
  cidr(name: string, options?: ColumnOptions): unknown;
  citext(name: string, options?: ColumnOptions): unknown;
  daterange(name: string, options?: ColumnOptions): unknown;
  hstore(name: string, options?: ColumnOptions): unknown;
  inet(name: string, options?: ColumnOptions): unknown;
  int4range(name: string, options?: ColumnOptions): unknown;
  int8range(name: string, options?: ColumnOptions): unknown;
  interval(name: string, options?: ColumnOptions): unknown;
  jsonb(name: string, options?: ColumnOptions): unknown;
  ltree(name: string, options?: ColumnOptions): unknown;
  macaddr(name: string, options?: ColumnOptions): unknown;
  money(name: string, options?: ColumnOptions): unknown;
  numrange(name: string, options?: ColumnOptions): unknown;
  oid(name: string, options?: ColumnOptions): unknown;
  point(name: string, options?: ColumnOptions): unknown;
  line(name: string, options?: ColumnOptions): unknown;
  lseg(name: string, options?: ColumnOptions): unknown;
  box(name: string, options?: ColumnOptions): unknown;
  path(name: string, options?: ColumnOptions): unknown;
  polygon(name: string, options?: ColumnOptions): unknown;
  circle(name: string, options?: ColumnOptions): unknown;
  serial(name: string, options?: ColumnOptions): unknown;
  tsrange(name: string, options?: ColumnOptions): unknown;
  tstzrange(name: string, options?: ColumnOptions): unknown;
  tsvector(name: string, options?: ColumnOptions): unknown;
  uuid(name: string, options?: ColumnOptions): unknown;
  xml(name: string, options?: ColumnOptions): unknown;
  enumType(name: string, enumName: string, options?: ColumnOptions): unknown;
}

export class TableDefinition extends AbstractTableDefinition {
  constructor(tableName: string, options: { id?: boolean | "uuid" } = {}) {
    super(tableName, { ...options, adapterName: "postgres" });
  }

  bigserial(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "bigint" as ColumnType, options));
    return this;
  }

  cidr(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  citext(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "text" as ColumnType, options));
    return this;
  }

  hstore(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  inet(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  interval(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  ltree(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  macaddr(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  money(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "decimal" as ColumnType, options));
    return this;
  }

  point(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  line(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  lseg(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  box(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  path(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  polygon(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  circle(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  tsvector(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }

  xml(name: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "text" as ColumnType, options));
    return this;
  }

  enumType(name: string, _enumName: string, options: ColumnOptions = {}): this {
    this.columns.push(new ColumnDefinition(name, "string" as ColumnType, options));
    return this;
  }
}

export class Table extends AbstractTable {
  constructor(tableName: string, schema: SchemaStatementsLike) {
    super(tableName, schema);
  }
}

export class AlterTable extends AbstractAlterTable {
  constructor(name: string) {
    super(name);
  }
}
