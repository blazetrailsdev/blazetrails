import { Nodes } from "@blazetrails/arel";
import type { Base } from "./base.js";
import { quoteSqlValue } from "./base.js";
import type { Relation } from "./relation.js";

type ModelClass = typeof Base;

export interface InsertAllOptions {
  onDuplicate?: "skip" | "update" | Nodes.SqlLiteral;
  updateOnly?: string | string[];
  returning?: boolean | string | string[];
  uniqueBy?: string | string[];
  recordTimestamps?: boolean;
}

export class InsertAll {
  readonly model: ModelClass;
  readonly connection: ModelClass["adapter"];
  readonly inserts: Record<string, unknown>[];
  readonly keys: Set<string>;
  readonly onDuplicate: "skip" | "update" | undefined;
  readonly updateOnly: string | string[] | undefined;
  readonly returning: boolean | string | string[] | undefined;
  readonly uniqueBy: string | string[] | undefined;
  readonly updateSql: Nodes.SqlLiteral | undefined;

  private _relation: Relation<any>;
  private _scopeAttributes: Record<string, unknown>;
  private _recordTimestamps: boolean;
  private _updatableColumns: string[] | undefined;

  static async execute(
    relation: Relation<any>,
    inserts: Record<string, unknown>[],
    options: InsertAllOptions = {},
  ): Promise<number> {
    const model = (relation as any)._modelClass as ModelClass;
    const ia = new InsertAll(relation, model.adapter, inserts, options);
    return ia.execute();
  }

  constructor(
    relation: Relation<any>,
    connection: ModelClass["adapter"],
    inserts: Record<string, unknown>[],
    options: InsertAllOptions = {},
  ) {
    this._relation = relation;
    this.model = (relation as any)._modelClass as ModelClass;
    this.connection = connection;
    this.inserts = inserts.map((r) => ({ ...r }));

    const onDuplicate = options.onDuplicate;
    this.updateOnly = options.updateOnly;
    this.returning = options.returning;
    this.uniqueBy = options.uniqueBy;
    this._recordTimestamps = options.recordTimestamps ?? false;
    this.updateSql = undefined;

    if (this.inserts.length === 0) {
      this.keys = new Set();
    } else {
      this.keys = new Set(Object.keys(this.inserts[0]));
    }

    this._scopeAttributes = {
      ...(relation as any)._createWithAttrs,
      ...(relation as any)._scopeAttributes(),
    };
    for (const key of Object.keys(this._scopeAttributes)) {
      this.keys.add(key);
    }

    this._configureDuplicateLogic(onDuplicate);
  }

  async execute(): Promise<number> {
    if (this.inserts.length === 0) return 0;

    const table = this.model.arelTable;
    const columns = [...this.keys];
    const colList = columns.map((c) => `"${c}"`).join(", ");

    const arrayCols = this._arrayColumnSet(columns);
    const mergedRows = this.inserts.map((row) => {
      const merged = { ...this._scopeAttributes, ...row };
      const vals = columns.map((c) => quoteSqlValue(merged[c], arrayCols.has(c)));
      return `(${vals.join(", ")})`;
    });

    const uniqueCols = this._resolveUniqueColumns();
    const isMysql = !!process.env.MYSQL_TEST_URL;
    let sql: string;

    if (this.skipDuplicates()) {
      if (isMysql) {
        sql = `INSERT IGNORE INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")}`;
      } else {
        const conflictTarget = `ON CONFLICT (${uniqueCols.map((c) => `"${c}"`).join(", ")})`;
        sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")} ${conflictTarget} DO NOTHING`;
      }
    } else if (this.updateSql) {
      if (isMysql) {
        sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")} ON DUPLICATE KEY UPDATE ${this.updateSql.value}`;
      } else {
        const conflictTarget = `ON CONFLICT (${uniqueCols.map((c) => `"${c}"`).join(", ")})`;
        sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")} ${conflictTarget} DO UPDATE SET ${this.updateSql.value}`;
      }
    } else if (this.updateDuplicates()) {
      const updateCols = this.updatableColumns();
      let updateClause: string;
      if (isMysql) {
        updateClause =
          updateCols.length > 0
            ? updateCols.map((c) => `"${c}" = VALUES("${c}")`).join(", ")
            : `"${columns[0]}" = VALUES("${columns[0]}")`;
        sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")} ON DUPLICATE KEY UPDATE ${updateClause}`;
      } else {
        updateClause =
          updateCols.length > 0
            ? updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")
            : `"${columns[0]}" = EXCLUDED."${columns[0]}"`;
        const conflictTarget = `ON CONFLICT (${uniqueCols.map((c) => `"${c}"`).join(", ")})`;
        sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")} ${conflictTarget} DO UPDATE SET ${updateClause}`;
      }
    } else {
      // Plain insert — no conflict handling
      sql = `INSERT INTO "${table.name}" (${colList}) VALUES ${mergedRows.join(", ")}`;
    }

    return this.model.adapter.executeMutation(sql);
  }

  updatableColumns(): string[] {
    if (this._updatableColumns) return this._updatableColumns;
    const pk = this.model.primaryKey;
    const pkCols = Array.isArray(pk) ? pk : [pk];
    const uniqueByCols = this.uniqueBy
      ? Array.isArray(this.uniqueBy)
        ? this.uniqueBy
        : [this.uniqueBy]
      : [];
    const exclude = new Set([...pkCols, ...uniqueByCols]);
    this._updatableColumns = [...this.keys].filter((k) => !exclude.has(k));
    return this._updatableColumns;
  }

  primaryKeys(): string[] {
    const pk = this.model.primaryKey;
    return Array.isArray(pk) ? pk : [pk];
  }

  skipDuplicates(): boolean {
    return this.onDuplicate === "skip";
  }

  updateDuplicates(): boolean {
    return this.onDuplicate === "update";
  }

  mapKeyWithValue(fn: (key: string, value: unknown) => unknown): unknown[][] {
    return this.inserts.map((row) => {
      const merged = { ...this._scopeAttributes, ...row };
      return [...this.keysIncludingTimestamps()].map((key) => fn(key, merged[key]));
    });
  }

  recordTimestamps(): boolean {
    return this._recordTimestamps;
  }

  keysIncludingTimestamps(): Set<string> {
    return this.keys;
  }

  private _configureDuplicateLogic(onDuplicate: InsertAllOptions["onDuplicate"]): void {
    if (onDuplicate instanceof Nodes.SqlLiteral && this.updateOnly !== undefined) {
      throw new Error(
        "You can't set :update_only and provide custom update SQL via :on_duplicate at the same time",
      );
    }
    if (
      onDuplicate !== undefined &&
      onDuplicate !== "update" &&
      !(onDuplicate instanceof Nodes.SqlLiteral) &&
      this.updateOnly !== undefined
    ) {
      throw new Error("Cannot use both onDuplicate and updateOnly");
    }

    if (this.updateOnly !== undefined) {
      this._updatableColumns = Array.isArray(this.updateOnly) ? this.updateOnly : [this.updateOnly];
      (this as any).onDuplicate = "update";
    } else if (onDuplicate instanceof Nodes.SqlLiteral) {
      (this as any).updateSql = onDuplicate;
      (this as any).onDuplicate = "update";
    } else if (onDuplicate === "skip") {
      (this as any).onDuplicate = "skip";
    } else if (onDuplicate === "update") {
      if (this.updatableColumns().length === 0) {
        (this as any).onDuplicate = "skip";
      } else {
        (this as any).onDuplicate = "update";
      }
    } else {
      (this as any).onDuplicate = undefined;
    }
  }

  private _resolveUniqueColumns(): string[] {
    if (this.uniqueBy) {
      return Array.isArray(this.uniqueBy) ? this.uniqueBy : [this.uniqueBy];
    }
    return this.primaryKeys();
  }

  private _arrayColumnSet(columns: string[]): Set<string> {
    return new Set(
      columns.filter((c) => {
        const def = this.model._attributeDefinitions.get(c);
        return def?.type?.name === "array";
      }),
    );
  }
}

export class Builder {
  readonly model: ModelClass;
  private _insertAll: InsertAll;
  private _connection: ModelClass["adapter"];

  constructor(insertAll: InsertAll) {
    this._insertAll = insertAll;
    this.model = insertAll.model;
    this._connection = insertAll.connection;
  }

  into(): string {
    return `INTO "${this.model.arelTable.name}" (${this._columnsList()})`;
  }

  valuesList(): string {
    const keys = [...this._insertAll.keysIncludingTimestamps()];
    const rows = this._insertAll.mapKeyWithValue((key, value) => {
      if (value instanceof Nodes.SqlLiteral) return value;
      const def = this.model._attributeDefinitions.get(key);
      return def?.type ? def.type.cast(value) : value;
    });
    return rows
      .map((row) => `(${(row as unknown[]).map((v) => quoteSqlValue(v, false)).join(", ")})`)
      .join(", ");
  }

  returning(): string | undefined {
    const ret = this._insertAll.returning;
    if (!ret) return undefined;
    if (typeof ret === "string") return ret;
    if (Array.isArray(ret)) return ret.map((c) => `"${c}"`).join(", ");
    return undefined;
  }

  conflictTarget(): string | undefined {
    if (this._insertAll.uniqueBy) {
      const cols = Array.isArray(this._insertAll.uniqueBy)
        ? this._insertAll.uniqueBy
        : [this._insertAll.uniqueBy];
      return `(${cols.map((c) => `"${c}"`).join(", ")})`;
    }
    if (this._insertAll.updateDuplicates()) {
      return `(${this._insertAll
        .primaryKeys()
        .map((c) => `"${c}"`)
        .join(", ")})`;
    }
    return undefined;
  }

  updatableColumns(): string[] {
    return this._insertAll.updatableColumns().map((c) => `"${c}"`);
  }

  touchModelTimestampsUnless(_block: (col: string) => string): string {
    if (!this._insertAll.updateDuplicates() || !this._insertAll.recordTimestamps()) {
      return "";
    }
    return "";
  }

  rawUpdateSql(): Nodes.SqlLiteral | undefined {
    return this._insertAll.updateSql;
  }

  private _columnsList(): string {
    return [...this._insertAll.keysIncludingTimestamps()].map((c) => `"${c}"`).join(", ");
  }
}

// Attach Builder as a static property for Rails API parity (InsertAll::Builder)
(InsertAll as any).Builder = Builder;
