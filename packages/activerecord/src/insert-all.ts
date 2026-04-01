import { InsertManager, Nodes } from "@blazetrails/arel";
import type { Base } from "./base.js";
import type { Relation } from "./relation.js";

type ModelClass = typeof Base;

const TIMESTAMP_COLUMNS = ["created_at", "updated_at"] as const;

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
  readonly returning: boolean | string | string[] | undefined;
  readonly uniqueBy: string | string[] | undefined;

  onDuplicate: "skip" | "update" | undefined;
  updateOnly: string | string[] | undefined;
  updateSql: Nodes.SqlLiteral | undefined;

  private _scopeAttributes: Record<string, unknown>;
  private _recordTimestamps: boolean;
  private _updatableColumns: string[] | undefined;
  private _keysIncludingTimestamps: Set<string> | undefined;

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
    this.model = (relation as any)._modelClass as ModelClass;
    this.connection = connection;
    this.inserts = inserts.map((r) => ({ ...r }));
    this.updateOnly = options.updateOnly;
    this.returning = options.returning;
    this.uniqueBy = options.uniqueBy;
    this._recordTimestamps = options.recordTimestamps ?? this.model.recordTimestamps;
    this.updateSql = undefined;
    this.onDuplicate = undefined;

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

    this._configureDuplicateLogic(options.onDuplicate);
  }

  async execute(): Promise<number> {
    if (this.inserts.length === 0) return 0;
    const builder = new Builder(this);
    return this.connection.executeMutation(builder.toSql());
  }

  updatableColumns(): string[] {
    if (this._updatableColumns) return this._updatableColumns;
    const exclude = new Set([...this.primaryKeys(), ...this._uniqueByColumns()]);
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
      if (this.recordTimestamps()) {
        const now = new Date();
        for (const col of TIMESTAMP_COLUMNS) {
          if (this.model._attributeDefinitions.has(col) && merged[col] === undefined) {
            merged[col] = now;
          }
        }
      }
      return [...this.keysIncludingTimestamps()].map((key) => fn(key, merged[key]));
    });
  }

  recordTimestamps(): boolean {
    return this._recordTimestamps;
  }

  keysIncludingTimestamps(): Set<string> {
    if (this._keysIncludingTimestamps) return this._keysIncludingTimestamps;
    if (this.recordTimestamps()) {
      const result = new Set(this.keys);
      for (const col of TIMESTAMP_COLUMNS) {
        if (this.model._attributeDefinitions.has(col)) {
          result.add(col);
        }
      }
      this._keysIncludingTimestamps = result;
    } else {
      this._keysIncludingTimestamps = this.keys;
    }
    return this._keysIncludingTimestamps;
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
      this.onDuplicate = "update";
    } else if (onDuplicate instanceof Nodes.SqlLiteral) {
      this.updateSql = onDuplicate;
      this.onDuplicate = "update";
    } else if (onDuplicate === "skip") {
      this.onDuplicate = "skip";
    } else if (onDuplicate === "update") {
      this.onDuplicate = this.updatableColumns().length === 0 ? "skip" : "update";
    }
  }

  private _uniqueByColumns(): string[] {
    if (!this.uniqueBy) return [];
    return Array.isArray(this.uniqueBy) ? this.uniqueBy : [this.uniqueBy];
  }
}

export class Builder {
  readonly model: ModelClass;
  private _insertAll: InsertAll;

  constructor(insertAll: InsertAll) {
    this._insertAll = insertAll;
    this.model = insertAll.model;
  }

  toSql(): string {
    const baseSql = this._buildInsertSql();
    const conflictSql = this._buildConflictSql();
    return conflictSql ? `${baseSql} ${conflictSql}` : baseSql;
  }

  into(): string {
    return `INTO "${this.model.arelTable.name}" (${this._columnsList()})`;
  }

  valuesList(): Nodes.ValuesList {
    const rows = this._insertAll.mapKeyWithValue((_key, value) => {
      if (value instanceof Nodes.SqlLiteral) return value;
      return new Nodes.Quoted(value);
    });
    return new Nodes.ValuesList(rows as Nodes.Node[][]);
  }

  returning(): string | undefined {
    const ret = this._insertAll.returning;
    if (!ret) return undefined;
    if (typeof ret === "string") return `"${ret}"`;
    if (Array.isArray(ret)) return ret.map((c) => `"${c}"`).join(", ");
    return undefined;
  }

  conflictTarget(): string {
    if (this._insertAll.uniqueBy) {
      const cols = Array.isArray(this._insertAll.uniqueBy)
        ? this._insertAll.uniqueBy
        : [this._insertAll.uniqueBy];
      return `(${cols.map((c) => `"${c}"`).join(", ")})`;
    }
    return `(${this._insertAll
      .primaryKeys()
      .map((c) => `"${c}"`)
      .join(", ")})`;
  }

  updatableColumns(): string[] {
    return this._insertAll.updatableColumns().map((c) => `"${c}"`);
  }

  touchModelTimestampsUnless(block: (col: string) => string): string {
    if (!this._insertAll.updateDuplicates() || !this._insertAll.recordTimestamps()) {
      return "";
    }
    const updatable = this._insertAll.updatableColumns();
    const parts: string[] = [];
    for (const col of TIMESTAMP_COLUMNS) {
      if (this.model._attributeDefinitions.has(col) && !updatable.includes(col)) {
        const conditions = this.updatableColumns().map(block).join(" AND ");
        parts.push(
          `"${col}"=(CASE WHEN (${conditions}) THEN "${this.model.arelTable.name}"."${col}" ELSE CURRENT_TIMESTAMP END)`,
        );
      }
    }
    return parts.join(",");
  }

  rawUpdateSql(): Nodes.SqlLiteral | undefined {
    return this._insertAll.updateSql;
  }

  private _buildInsertSql(): string {
    const table = this.model.arelTable;
    const keys = [...this._insertAll.keysIncludingTimestamps()];

    const mgr = new InsertManager(table);
    mgr.ast.columns = keys.map((k) => table.get(k));
    mgr.values(this.valuesList());
    return mgr.toSql();
  }

  private _buildConflictSql(): string | undefined {
    const isMysql = !!process.env.MYSQL_TEST_URL;
    const ia = this._insertAll;

    if (ia.skipDuplicates()) {
      if (isMysql) return undefined; // MySQL uses INSERT IGNORE (handled separately)
      return `ON CONFLICT ${this.conflictTarget()} DO NOTHING`;
    }

    if (ia.updateSql) {
      if (isMysql) {
        return `ON DUPLICATE KEY UPDATE ${ia.updateSql.value}`;
      }
      return `ON CONFLICT ${this.conflictTarget()} DO UPDATE SET ${ia.updateSql.value}`;
    }

    if (ia.updateDuplicates()) {
      const updateCols = this.updatableColumns();
      if (isMysql) {
        const clause =
          updateCols.length > 0
            ? updateCols.map((c) => `${c} = VALUES(${c})`).join(", ")
            : `${this._firstColumn()} = VALUES(${this._firstColumn()})`;
        return `ON DUPLICATE KEY UPDATE ${clause}`;
      }
      const clause =
        updateCols.length > 0
          ? updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")
          : `${this._firstColumn()} = EXCLUDED.${this._firstColumn()}`;
      return `ON CONFLICT ${this.conflictTarget()} DO UPDATE SET ${clause}`;
    }

    return undefined;
  }

  private _columnsList(): string {
    return [...this._insertAll.keysIncludingTimestamps()].map((c) => `"${c}"`).join(", ");
  }

  private _firstColumn(): string {
    const keys = [...this._insertAll.keysIncludingTimestamps()];
    return `"${keys[0]}"`;
  }
}
