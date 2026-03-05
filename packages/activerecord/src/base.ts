import { Model } from "@rails-js/activemodel";
import { Table } from "@rails-js/arel";
import type { DatabaseAdapter } from "./adapter.js";
import { getInheritanceColumn, isStiSubclass, getStiBase, instantiateSti } from "./sti.js";
import {
  RecordNotFound,
  RecordInvalid,
  RecordNotSaved,
  RecordNotDestroyed,
  StaleObjectError,
  ReadOnlyRecord,
} from "./errors.js";

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
let _wrapWithScopeProxy: ((rel: any) => any) | null = null;

/** @internal Called by relation.ts to register itself. */
export function _setRelationCtor(ctor: new (modelClass: typeof Base) => any): void {
  _RelationCtor = ctor;
}

/** @internal Called by relation.ts to register the scope proxy wrapper. */
export function _setScopeProxyWrapper(wrapper: (rel: any) => any): void {
  _wrapWithScopeProxy = wrapper;
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
    // STI subclasses inherit the base class's table name
    if (isStiSubclass(this)) {
      return getStiBase(this).tableName;
    }
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
  static _defaultScope: ((rel: any) => any) | null = null;

  /**
   * Define a default scope applied to all queries.
   *
   * Mirrors: ActiveRecord::Base.default_scope
   */
  static defaultScope(fn: (rel: any) => any): void {
    this._defaultScope = fn;
  }

  /**
   * Return a relation that bypasses the default scope.
   *
   * Mirrors: ActiveRecord::Base.unscoped
   */
  static unscoped(): any {
    if (!_RelationCtor) {
      throw new Error("Relation not loaded. Import relation.ts first.");
    }
    const rel = new _RelationCtor(this);
    return _wrapWithScopeProxy ? _wrapWithScopeProxy(rel) : rel;
  }

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

    // Define a static method on the class that delegates to all().scopeName()
    Object.defineProperty(this, name, {
      value: function (...args: any[]) {
        return (this as typeof Base).all()[name](...args);
      },
      writable: true,
      configurable: true,
    });
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
        throw new RecordNotFound(
          `${this.name} with ${this.primaryKey} in [${missing.join(", ")}] not found`,
          this.name, this.primaryKey, id
        );
      }
      return records;
    }
    // Single ID
    const record = await this.findBy({ [this.primaryKey]: id });
    if (!record) {
      throw new RecordNotFound(
        `${this.name} with ${this.primaryKey}=${id} not found`,
        this.name, this.primaryKey, id
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
      throw new RecordNotFound(`${this.name} not found`, this.name);
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
    let rel = new _RelationCtor(this);
    rel = _wrapWithScopeProxy ? _wrapWithScopeProxy(rel) : rel;
    // Apply default scope if defined
    if (this._defaultScope) {
      rel = this._defaultScope(rel);
    }
    // STI subclasses auto-filter by type column
    if (isStiSubclass(this)) {
      const col = getInheritanceColumn(getStiBase(this));
      if (col) {
        rel = rel.where({ [col]: this.name });
      }
    }
    return rel;
  }

  /**
   * Shorthand for all().where(conditions).
   *
   * Mirrors: ActiveRecord::Base.where
   */
  static where(conditions: Record<string, unknown>): any;
  static where(sql: string, ...binds: unknown[]): any;
  static where(conditionsOrSql: Record<string, unknown> | string, ...binds: unknown[]): any {
    if (typeof conditionsOrSql === "string") {
      return this.all().where(conditionsOrSql, ...binds);
    }
    return this.all().where(conditionsOrSql);
  }

  /**
   * Insert multiple records in a single INSERT statement (skip callbacks/validations).
   *
   * Mirrors: ActiveRecord::Base.insert_all
   */
  static async insertAll(
    records: Record<string, unknown>[],
    options?: { uniqueBy?: string | string[] }
  ): Promise<number> {
    return this.all().insertAll(records, options);
  }

  /**
   * Upsert multiple records in a single statement (skip callbacks/validations).
   *
   * Mirrors: ActiveRecord::Base.upsert_all
   */
  static async upsertAll(
    records: Record<string, unknown>[],
    options?: { uniqueBy?: string | string[] }
  ): Promise<number> {
    return this.all().upsertAll(records, options);
  }

  /**
   * Find the first record matching conditions, or create one.
   *
   * Mirrors: ActiveRecord::Base.find_or_create_by
   */
  static async findOrCreateBy(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Promise<Base> {
    const record = await this.findBy(conditions);
    if (record) return record;
    return this.create({ ...conditions, ...extra });
  }

  /**
   * Find the first record matching conditions, or instantiate one (unsaved).
   *
   * Mirrors: ActiveRecord::Base.find_or_initialize_by
   */
  static async findOrInitializeBy(
    conditions: Record<string, unknown>,
    extra?: Record<string, unknown>
  ): Promise<Base> {
    const record = await this.findBy(conditions);
    if (record) return record;
    return new this({ ...conditions, ...extra });
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
    // If STI is enabled, delegate to the correct subclass
    const inheritanceCol = getInheritanceColumn(this);
    if (inheritanceCol && row[inheritanceCol] && row[inheritanceCol] !== this.name) {
      return instantiateSti(this, row);
    }

    const record = new this(row);
    record._newRecord = false;
    record._dirty.snapshot(record._attributes);
    record.changesApplied();
    // Fire after_find callbacks
    this._callbackChain.runAfter("find", record);
    return record;
  }

  // -- Instance state --

  _newRecord = true;
  private _destroyed = false;
  private _readonly = false;
  _preloadedAssociations: Map<string, unknown> = new Map();

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
   * Returns true if the record is marked readonly.
   *
   * Mirrors: ActiveRecord::Base#readonly?
   */
  isReadonly(): boolean {
    return this._readonly;
  }

  /**
   * Mark the record as readonly. Raises on save/update/destroy.
   *
   * Mirrors: ActiveRecord::Base#readonly!
   */
  readonlyBang(): this {
    this._readonly = true;
    return this;
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
   * Increment an attribute in memory.
   *
   * Mirrors: ActiveRecord::Base#increment
   */
  increment(attribute: string, by: number = 1): this {
    const current = Number(this.readAttribute(attribute)) || 0;
    this.writeAttribute(attribute, current + by);
    return this;
  }

  /**
   * Decrement an attribute in memory.
   *
   * Mirrors: ActiveRecord::Base#decrement
   */
  decrement(attribute: string, by: number = 1): this {
    const current = Number(this.readAttribute(attribute)) || 0;
    this.writeAttribute(attribute, current - by);
    return this;
  }

  /**
   * Toggle a boolean attribute in memory.
   *
   * Mirrors: ActiveRecord::Base#toggle
   */
  toggle(attribute: string): this {
    const current = this.readAttribute(attribute);
    this.writeAttribute(attribute, !current);
    return this;
  }

  /**
   * Increment and persist using updateColumn (skip validations).
   *
   * Mirrors: ActiveRecord::Base#increment!
   */
  async incrementBang(attribute: string, by: number = 1): Promise<this> {
    this.increment(attribute, by);
    await this.updateColumn(attribute, this.readAttribute(attribute));
    return this;
  }

  /**
   * Decrement and persist using updateColumn (skip validations).
   *
   * Mirrors: ActiveRecord::Base#decrement!
   */
  async decrementBang(attribute: string, by: number = 1): Promise<this> {
    this.decrement(attribute, by);
    await this.updateColumn(attribute, this.readAttribute(attribute));
    return this;
  }

  /**
   * Toggle and persist using updateColumn (skip validations).
   *
   * Mirrors: ActiveRecord::Base#toggle!
   */
  async toggleBang(attribute: string): Promise<this> {
    this.toggle(attribute);
    await this.updateColumn(attribute, this.readAttribute(attribute));
    return this;
  }

  /**
   * Run async validations (like uniqueness).
   */
  private async _runAsyncValidations(): Promise<boolean> {
    const ctor = this.constructor as typeof Base;
    const asyncValidators: Array<{ attribute: string; options: any }> =
      (ctor as any)._asyncValidations ?? [];

    for (const { attribute, options } of asyncValidators) {
      const value = this.readAttribute(attribute);
      if (value === null || value === undefined) continue;

      const conditions: Record<string, unknown> = { [attribute]: value };

      // Add scope columns
      if (options.scope) {
        const scopes = Array.isArray(options.scope) ? options.scope : [options.scope];
        for (const scopeCol of scopes) {
          conditions[scopeCol] = this.readAttribute(scopeCol);
        }
      }

      // Exclude self if persisted
      const existing = await ctor.findBy(conditions);
      if (existing && (!this.isPersisted() || existing.id !== this.id)) {
        this.errors.add(attribute, "taken", { message: options.message });
      }
    }

    return this.errors.empty;
  }

  /**
   * Register a uniqueness validation.
   *
   * Mirrors: validates uniqueness: true
   */
  static validatesUniqueness(
    attribute: string,
    options: { scope?: string | string[]; message?: string } = {}
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, "_asyncValidations")) {
      (this as any)._asyncValidations = [...((this as any)._asyncValidations ?? [])];
    }
    (this as any)._asyncValidations.push({ attribute, options });
  }

  /**
   * Save the record. Returns true if successful, false if validation fails.
   * Raises if the record has been destroyed.
   *
   * Mirrors: ActiveRecord::Base#save
   */
  async save(): Promise<boolean> {
    if (this._destroyed) {
      throw new RecordNotSaved(
        `Cannot save a destroyed ${(this.constructor as typeof Base).name}`, this
      );
    }
    if (this._readonly) {
      throw new ReadOnlyRecord(this);
    }
    // Set validation context for on: :create / on: :update
    this._validationContext = this._newRecord ? "create" : "update";
    if (!this.isValid()) {
      this._validationContext = null;
      return false;
    }
    this._validationContext = null;

    // Run async validations (uniqueness)
    if (!await this._runAsyncValidations()) return false;

    const ctor = this.constructor as typeof Base;

    // Auto-set STI type column on new records
    if (this._newRecord && isStiSubclass(ctor)) {
      const col = getInheritanceColumn(getStiBase(ctor));
      if (col && !this.readAttribute(col)) {
        this._attributes.set(col, ctor.name);
      }
    }

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
      const wasNewRecord = this._newRecord;
      this._newRecord = false;
      this.changesApplied();

      // Counter cache: increment on create
      if (wasNewRecord) {
        const { updateCounterCaches } = await import("./associations.js");
        await updateCounterCaches(this, "increment");
      }

      // Touch parent associations
      const { touchBelongsToParents } = await import("./associations.js");
      await touchBelongsToParents(this);

      // Fire after_commit callbacks
      const { currentTransaction } = await import("./transactions.js");
      const tx = currentTransaction();
      if (tx) {
        // Inside a transaction — defer to commit
        tx.afterCommit(() => {
          ctor._callbackChain.runAfter("commit", this);
        });
        tx.afterRollback(() => {
          ctor._callbackChain.runAfter("rollback", this);
        });
      } else {
        // Not in a transaction — fire immediately
        ctor._callbackChain.runAfter("commit", this);
      }
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
      throw new RecordInvalid(this);
    }
    return true;
  }

  private _pendingOperation: Promise<void> | null = null;

  private _performInsert(): void {
    const ctor = this.constructor as typeof Base;
    const table = ctor.arelTable;

    // Auto-populate timestamps
    const now = new Date();
    if (ctor._attributeDefinitions.has("created_at") && this.readAttribute("created_at") === null) {
      this._attributes.set("created_at", now);
    }
    if (ctor._attributeDefinitions.has("updated_at") && this.readAttribute("updated_at") === null) {
      this._attributes.set("updated_at", now);
    }

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
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
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

    // Auto-populate updated_at timestamp
    if (ctor._attributeDefinitions.has("updated_at")) {
      this.writeAttribute("updated_at", new Date());
    }

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
        if (typeof val === "object") return `"${key}" = '${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `"${key}" = '${String(val).replace(/'/g, "''")}'`;
      })
      .join(", ");

    const pk = this.id;
    const pkQuoted =
      typeof pk === "number"
        ? String(pk)
        : `'${String(pk).replace(/'/g, "''")}'`;

    // Optimistic locking: include lock_version in WHERE and increment it
    let lockClause = "";
    if (ctor._attributeDefinitions.has("lock_version")) {
      const currentVersion = Number(this.readAttribute("lock_version")) || 0;
      lockClause = ` AND "lock_version" = ${currentVersion}`;
      this._attributes.set("lock_version", currentVersion + 1);
    }

    const finalSetClause = ctor._attributeDefinitions.has("lock_version")
      ? `${setClause}, "lock_version" = ${this.readAttribute("lock_version")}`
      : setClause;

    const sql = `UPDATE "${table.name}" SET ${finalSetClause} WHERE "${ctor.primaryKey}" = ${pkQuoted}${lockClause}`;
    this._pendingOperation = ctor.adapter.executeMutation(sql).then((affected) => {
      if (lockClause && affected === 0) {
        throw new StaleObjectError(this, "update");
      }
    });
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
    if (this._readonly) {
      throw new ReadOnlyRecord(this);
    }
    const ctor = this.constructor as typeof Base;

    // Process dependent associations before destroy
    const { processDependentAssociations } = await import("./associations.js");
    await processDependentAssociations(this);

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

    // Counter cache: decrement on destroy
    const { updateCounterCaches } = await import("./associations.js");
    await updateCounterCaches(this, "decrement");

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
      throw new RecordNotFound(
        `${ctor.name} with ${ctor.primaryKey}=${this.id} not found`,
        ctor.name, ctor.primaryKey, this.id
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

  /**
   * Update the updated_at timestamp (and optionally other timestamp
   * columns) without changing other attributes. Skips validations
   * and callbacks.
   *
   * Mirrors: ActiveRecord::Base#touch
   */
  async touch(...names: string[]): Promise<boolean> {
    if (!this.isPersisted()) return false;
    const now = new Date();
    const attrs: Record<string, unknown> = {};

    // Always touch updated_at if defined
    const ctor = this.constructor as typeof Base;
    if (ctor._attributeDefinitions.has("updated_at")) {
      attrs.updated_at = now;
    }

    // Touch any additional named timestamps
    for (const name of names) {
      attrs[name] = now;
    }

    if (Object.keys(attrs).length === 0) return false;

    await this.updateColumns(attrs);
    return true;
  }

  /**
   * Update a single column directly in the database, skipping
   * validations and callbacks.
   *
   * Mirrors: ActiveRecord::Base#update_column
   */
  async updateColumn(name: string, value: unknown): Promise<void> {
    return this.updateColumns({ [name]: value });
  }

  /**
   * Update multiple columns directly in the database, skipping
   * validations and callbacks.
   *
   * Mirrors: ActiveRecord::Base#update_columns
   */
  async updateColumns(attrs: Record<string, unknown>): Promise<void> {
    if (!this.isPersisted()) {
      throw new Error("Cannot update columns on a new or destroyed record");
    }

    const ctor = this.constructor as typeof Base;
    const table = ctor.arelTable;

    // Set attributes directly (no dirty tracking through writeAttribute)
    for (const [key, value] of Object.entries(attrs)) {
      const def = ctor._attributeDefinitions.get(key);
      this._attributes.set(key, def ? def.type.cast(value) : value);
    }

    const setClauses = Object.entries(attrs)
      .map(([key, _]) => {
        const val = this._attributes.get(key);
        if (val === null) return `"${key}" = NULL`;
        if (typeof val === "number") return `"${key}" = ${val}`;
        if (typeof val === "boolean") return `"${key}" = ${val ? "TRUE" : "FALSE"}`;
        if (val instanceof Date) return `"${key}" = '${val.toISOString()}'`;
        if (typeof val === "object") return `"${key}" = '${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `"${key}" = '${String(val).replace(/'/g, "''")}'`;
      })
      .join(", ");

    const pk = this.id;
    const pkQuoted =
      typeof pk === "number"
        ? String(pk)
        : `'${String(pk).replace(/'/g, "''")}'`;

    const sql = `UPDATE "${table.name}" SET ${setClauses} WHERE "${ctor.primaryKey}" = ${pkQuoted}`;
    await ctor.adapter.executeMutation(sql);

    // Reset dirty tracking to reflect the new persisted state
    this.changesApplied();
  }
}
