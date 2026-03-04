import { Model } from "@rails-js/activemodel";
import { Table } from "@rails-js/arel";
import type { DatabaseAdapter } from "./adapter.js";

/**
 * Pluralize a name (naive English pluralization).
 */
function pluralize(word: string): string {
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z")) {
    return word + "es";
  }
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return word.slice(0, -1) + "ies";
  }
  return word + "s";
}

/**
 * Convert CamelCase to snake_case.
 */
function underscore(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

// Late-bound Relation constructor to break circular dependency.
// Set by relation.ts when it loads.
let _RelationCtor: (new (modelClass: typeof Base) => any) | null = null;

/** @internal Called by relation.ts to register itself. */
export function _setRelationCtor(ctor: new (modelClass: typeof Base) => any): void {
  _RelationCtor = ctor;
}

/**
 * Base — the core ActiveRecord class with persistence and finders.
 *
 * Mirrors: ActiveRecord::Base
 */
export class Base extends Model {
  // -- Class-level configuration --
  static _tableName: string | null = null;
  static _primaryKey = "id";
  static _adapter: DatabaseAdapter | null = null;

  /**
   * Set or get the table name. Inferred from class name if not set.
   *
   * Mirrors: ActiveRecord::Base.table_name
   */
  static get tableName(): string {
    if (this._tableName) return this._tableName;
    return pluralize(underscore(this.name));
  }

  static set tableName(name: string) {
    this._tableName = name;
  }

  /**
   * Set or get the primary key. Defaults to "id".
   *
   * Mirrors: ActiveRecord::Base.primary_key
   */
  static get primaryKey(): string {
    return this._primaryKey;
  }

  static set primaryKey(key: string) {
    this._primaryKey = key;
  }

  /**
   * Get the Arel table for this model.
   *
   * Mirrors: ActiveRecord::Base.arel_table
   */
  static get arelTable(): Table {
    return new Table(this.tableName);
  }

  /**
   * Set the database adapter for this model class.
   */
  static set adapter(adapter: DatabaseAdapter) {
    this._adapter = adapter;
  }

  static get adapter(): DatabaseAdapter {
    if (!this._adapter) {
      throw new Error(
        `No adapter configured for ${this.name}. Set ${this.name}.adapter = yourAdapter`
      );
    }
    return this._adapter;
  }

  // -- Scopes registry (used by Relation) --
  static _scopes: Map<string, (rel: any, ...args: any[]) => any> = new Map();

  /**
   * Define a named scope.
   *
   * Mirrors: ActiveRecord::Base.scope
   */
  static scope(name: string, fn: (rel: any, ...args: any[]) => any): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_scopes")) {
      this._scopes = new Map(this._scopes);
    }
    this._scopes.set(name, fn);
  }

  // -- Finders (class methods) --

  /**
   * Find a record by primary key, or an array of records by primary keys.
   *
   * Mirrors: ActiveRecord::Base.find
   */
  static async find(id: unknown): Promise<any> {
    // Multiple IDs — return an array
    if (Array.isArray(id)) {
      if (id.length === 0) return [];
      const records = await this.all()
        .where({ [this.primaryKey]: id })
        .toArray();
      // Ensure all IDs were found
      if (records.length !== id.length) {
        const foundIds = new Set(records.map((r: Base) => r.id));
        const missing = id.filter((i) => !foundIds.has(i));
        throw new Error(
          `${this.name} with ${this.primaryKey} in [${missing.join(", ")}] not found`
        );
      }
      return records;
    }
    // Single ID
    const record = await this.findBy({ [this.primaryKey]: id });
    if (!record) {
      throw new Error(
        `${this.name} with ${this.primaryKey}=${id} not found`
      );
    }
    return record;
  }

  /**
   * Find the first record matching conditions.
   *
   * Mirrors: ActiveRecord::Base.find_by
   */
  static async findBy(
    conditions: Record<string, unknown>
  ): Promise<Base | null> {
    const table = this.arelTable;
    const manager = table.project("*");

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null) {
        manager.where(table.get(key).isNull());
      } else {
        manager.where(table.get(key).eq(value));
      }
    }

    manager.take(1);
    const sql = manager.toSql();
    const rows = await this.adapter.execute(sql);
    if (rows.length === 0) return null;

    return this._instantiate(rows[0]);
  }

  /**
   * Find the first record matching conditions, or throw.
   *
   * Mirrors: ActiveRecord::Base.find_by!
   */
  static async findByBang(
    conditions: Record<string, unknown>
  ): Promise<Base> {
    const record = await this.findBy(conditions);
    if (!record) {
      throw new Error(`${this.name} not found`);
    }
    return record;
  }

  /**
   * Return all records as a Relation.
   *
   * Mirrors: ActiveRecord::Base.all
   */
  static all(): any {
    if (!_RelationCtor) {
      throw new Error("Relation not loaded. Import relation.ts first.");
    }
    return new _RelationCtor(this);
  }

  /**
   * Shorthand for all().where(conditions).
   *
   * Mirrors: ActiveRecord::Base.where
   */
  static where(conditions: Record<string, unknown>): any {
    return this.all().where(conditions);
  }

  /**
   * Create a record and save it to the database.
   *
   * Mirrors: ActiveRecord::Base.create
   */
  static async create(
    attrs: Record<string, unknown> = {}
  ): Promise<Base> {
    const record = new this(attrs);
    await record.save();
    return record;
  }

  /**
   * Create a record or throw if validation fails.
   *
   * Mirrors: ActiveRecord::Base.create!
   */
  static async createBang(
    attrs: Record<string, unknown> = {}
  ): Promise<Base> {
    const record = new this(attrs);
    await record.saveBang();
    return record;
  }

  /**
   * Instantiate a model from a database row (marks it as persisted).
   */
  static _instantiate(row: Record<string, unknown>): Base {
    const record = new this(row);
    record._newRecord = false;
    record._dirty.snapshot(record._attributes);
    record.changesApplied();
    return record;
  }

  // -- Instance state --

  _newRecord = true;
  private _destroyed = false;

  /**
   * Returns true if the record has not been saved yet.
   *
   * Mirrors: ActiveRecord::Base#new_record?
   */
  isNewRecord(): boolean {
    return this._newRecord;
  }

  /**
   * Returns true if the record has been saved and not destroyed.
   *
   * Mirrors: ActiveRecord::Base#persisted?
   */
  isPersisted(): boolean {
    return !this._newRecord && !this._destroyed;
  }

  /**
   * Returns true if the record has been destroyed.
   *
   * Mirrors: ActiveRecord::Base#destroyed?
   */
  isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * The primary key value.
   */
  get id(): unknown {
    const ctor = this.constructor as typeof Base;
    return this.readAttribute(ctor.primaryKey);
  }

  set id(value: unknown) {
    const ctor = this.constructor as typeof Base;
    this.writeAttribute(ctor.primaryKey, value);
  }

  /**
   * Save the record. Returns true if successful, false if validation fails.
   * Raises if the record has been destroyed.
   *
   * Mirrors: ActiveRecord::Base#save
   */
  async save(): Promise<boolean> {
    if (this._destroyed) {
      throw new Error(
        `Cannot save a destroyed ${(this.constructor as typeof Base).name}`
      );
    }
    if (!this.isValid()) return false;

    const ctor = this.constructor as typeof Base;

    // Run save callbacks.
    // Use runBefore/runAfter to control the lifecycle:
    // before_save → before_create/update → INSERT/UPDATE → after_create/update → after_save
    let saved = false;
    if (!ctor._callbackChain.runBefore("save", this)) return false;

    if (this._newRecord) {
      const createResult = ctor._callbackChain.run("create", this, () => {
        this._performInsert();
        saved = true;
      });
      if (!createResult) saved = false;
    } else {
      const updateResult = ctor._callbackChain.run("update", this, () => {
        this._performUpdate();
        saved = true;
      });
      if (!updateResult) saved = false;
    }

    if (saved) {
      ctor._callbackChain.runAfter("save", this);
    }

    // Wait for the async operation
    if (this._pendingOperation) {
      await this._pendingOperation;
      this._pendingOperation = null;
    }

    if (saved) {
      this._newRecord = false;
      this.changesApplied();
    }

    return saved;
  }

  /**
   * Save the record or throw if validation fails.
   *
   * Mirrors: ActiveRecord::Base#save!
   */
  async saveBang(): Promise<true> {
    const result = await this.save();
    if (!result) {
      throw new Error(
        `Validation failed: ${this.errors.fullMessages.join(", ")}`
      );
    }
    return true;
  }

  private _pendingOperation: Promise<void> | null = null;

  private _performInsert(): void {
    const ctor = this.constructor as typeof Base;
    const table = ctor.arelTable;
    const attrs = this.attributes;
    const columns: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(attrs)) {
      if (key === ctor.primaryKey && value === null) continue;
      columns.push(key);
      values.push(value);
    }

    const colList = columns.map((c) => `"${c}"`).join(", ");
    const valList = values
      .map((v) => {
        if (v === null) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      })
      .join(", ");

    const sql = `INSERT INTO "${table.name}" (${colList}) VALUES (${valList})`;
    this._pendingOperation = ctor.adapter
      .executeMutation(sql)
      .then((insertedId) => {
        if (this.id === null) {
          this._attributes.set(ctor.primaryKey, insertedId);
        }
      });
  }

  private _performUpdate(): void {
    const ctor = this.constructor as typeof Base;
    const table = ctor.arelTable;
    const changedAttrs = this.changes;

    if (Object.keys(changedAttrs).length === 0) return;

    const setClause = Object.keys(changedAttrs)
      .map((key) => {
        const val = this.readAttribute(key);
        if (val === null) return `"${key}" = NULL`;
        if (typeof val === "number") return `"${key}" = ${val}`;
        if (typeof val === "boolean")
          return `"${key}" = ${val ? "TRUE" : "FALSE"}`;
        if (val instanceof Date) return `"${key}" = '${val.toISOString()}'`;
        return `"${key}" = '${String(val).replace(/'/g, "''")}'`;
      })
      .join(", ");

    const pk = this.id;
    const pkQuoted =
      typeof pk === "number"
        ? String(pk)
        : `'${String(pk).replace(/'/g, "''")}'`;

    const sql = `UPDATE "${table.name}" SET ${setClause} WHERE "${ctor.primaryKey}" = ${pkQuoted}`;
    this._pendingOperation = ctor.adapter.executeMutation(sql).then(() => {});
  }

  /**
   * Update attributes and save.
   *
   * Mirrors: ActiveRecord::Base#update
   */
  async update(attrs: Record<string, unknown>): Promise<boolean> {
    for (const [key, value] of Object.entries(attrs)) {
      this.writeAttribute(key, value);
    }
    return this.save();
  }

  /**
   * Update attributes and save, or throw on validation failure.
   *
   * Mirrors: ActiveRecord::Base#update!
   */
  async updateBang(attrs: Record<string, unknown>): Promise<true> {
    for (const [key, value] of Object.entries(attrs)) {
      this.writeAttribute(key, value);
    }
    return this.saveBang();
  }

  /**
   * Destroy the record.
   *
   * Mirrors: ActiveRecord::Base#destroy
   */
  async destroy(): Promise<this> {
    const ctor = this.constructor as typeof Base;

    ctor._callbackChain.run("destroy", this, () => {
      const table = ctor.arelTable;
      const pk = this.id;
      const pkQuoted =
        typeof pk === "number"
          ? String(pk)
          : `'${String(pk).replace(/'/g, "''")}'`;

      const sql = `DELETE FROM "${table.name}" WHERE "${ctor.primaryKey}" = ${pkQuoted}`;
      this._pendingOperation = ctor.adapter.executeMutation(sql).then(() => {});
    });

    if (this._pendingOperation) {
      await this._pendingOperation;
      this._pendingOperation = null;
    }

    this._destroyed = true;
    return this;
  }

  /**
   * Destroy the record or throw.
   *
   * Mirrors: ActiveRecord::Base#destroy!
   */
  async destroyBang(): Promise<this> {
    return this.destroy();
  }

  /**
   * Delete the record from the database without running callbacks.
   *
   * Mirrors: ActiveRecord::Base#delete
   */
  async delete(): Promise<this> {
    const ctor = this.constructor as typeof Base;
    const table = ctor.arelTable;
    const pk = this.id;
    const pkQuoted =
      typeof pk === "number"
        ? String(pk)
        : `'${String(pk).replace(/'/g, "''")}'`;

    const sql = `DELETE FROM "${table.name}" WHERE "${ctor.primaryKey}" = ${pkQuoted}`;
    await ctor.adapter.executeMutation(sql);

    this._destroyed = true;
    return this;
  }

  /**
   * Delete a record by primary key without callbacks.
   *
   * Mirrors: ActiveRecord::Base.delete
   */
  static async delete(id: unknown): Promise<number> {
    const table = this.arelTable;
    const pkQuoted =
      typeof id === "number"
        ? String(id)
        : `'${String(id).replace(/'/g, "''")}'`;
    const sql = `DELETE FROM "${table.name}" WHERE "${this.primaryKey}" = ${pkQuoted}`;
    return this.adapter.executeMutation(sql);
  }

  /**
   * Reload the record from the database.
   *
   * Mirrors: ActiveRecord::Base#reload
   */
  async reload(): Promise<this> {
    const ctor = this.constructor as typeof Base;
    const row = await ctor.adapter.execute(
      `SELECT * FROM "${ctor.tableName}" WHERE "${ctor.primaryKey}" = ${
        typeof this.id === "number" ? this.id : `'${this.id}'`
      }`
    );

    if (row.length === 0) {
      throw new Error(
        `${ctor.name} with ${ctor.primaryKey}=${this.id} not found`
      );
    }

    for (const [key, value] of Object.entries(row[0])) {
      this._attributes.set(key, value);
    }

    this._dirty.snapshot(this._attributes);
    return this;
  }

  /**
   * Returns the id as a string for URL params.
   *
   * Mirrors: ActiveRecord::Base#to_param
   */
  override toParam(): string | null {
    const pk = this.id;
    return pk != null ? String(pk) : null;
  }

  /**
   * Assign attributes without saving.
   *
   * Mirrors: ActiveRecord::Base#assign_attributes
   */
  assignAttributes(attrs: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(attrs)) {
      this.writeAttribute(key, value);
    }
  }
}
