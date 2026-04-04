/**
 * Core behavior mixed into every ActiveRecord model.
 *
 * Mirrors: ActiveRecord::Core
 */

/**
 * The Core module interface — methods mixed into every AR model.
 *
 * Mirrors: ActiveRecord::Core
 */
export interface Core {
  inspect(): string;
  attributeForInspect(attr: string): string;
  isEqual(other: unknown): boolean;
  isPresent(): boolean;
  isBlank(): boolean;
  isReadonly(): boolean;
  readonlyBang(): this;
  isStrictLoading(): boolean;
  strictLoadingBang(): this;
  isFrozen(): boolean;
  freeze(): this;
}

/**
 * Placeholder used in inspect output when an attribute value is masked
 * (e.g. for filtered attributes).
 *
 * Mirrors: ActiveRecord::Core::InspectionMask
 */
export class InspectionMask {
  private _value: string;

  constructor(value: string = "[FILTERED]") {
    this._value = value;
  }

  toString(): string {
    return this._value;
  }

  inspect(): string {
    return this._value;
  }
}

// ---------------------------------------------------------------------------
// Instance-level behavior
// ---------------------------------------------------------------------------

interface CoreRecord {
  id: unknown;
  _attributes: Iterable<[string, unknown]>;
  _newRecord: boolean;
  readAttribute(name: string): unknown;
  isPersisted(): boolean;
}

/**
 * Return a human-readable string representation of a record.
 *
 * Mirrors: ActiveRecord::Core#inspect
 */
export function inspect(this: CoreRecord): string {
  const ctor = this.constructor as { name: string };
  const attrs = Array.from(this._attributes)
    .map(([k, v]) => {
      if (v === null) return `${k}: nil`;
      if (v instanceof InspectionMask) return `${k}: ${v}`;
      if (typeof v === "string") return `${k}: "${v}"`;
      if (v instanceof Date) return `${k}: "${v.toISOString()}"`;
      return `${k}: ${JSON.stringify(v)}`;
    })
    .join(", ");
  return `#<${ctor.name} ${attrs}>`;
}

/**
 * Format a single attribute value for display in inspect output.
 *
 * Mirrors: ActiveRecord::Core#attribute_for_inspect
 */
export function attributeForInspect(this: CoreRecord, attr: string): string {
  const value = this.readAttribute(attr);
  if (value === null || value === undefined) return "nil";
  if (value instanceof InspectionMask) return value.toString();
  if (typeof value === "string") {
    if (value.length > 50) return `"${value.substring(0, 50)}..."`;
    return `"${value}"`;
  }
  if (value instanceof Date) return `"${value.toISOString()}"`;
  return JSON.stringify(value);
}

/**
 * Compare two records for equality by class and primary key.
 *
 * Mirrors: ActiveRecord::Core#==
 */
export function isEqual(this: CoreRecord, other: unknown): boolean {
  if (other === null || other === undefined) return false;
  if (typeof other !== "object") return false;
  if (!(other instanceof (this.constructor as any))) return false;
  if (this.constructor !== (other as any).constructor) return false;
  const thisId = this.id;
  const otherId = (other as CoreRecord).id;
  return thisId != null && thisId === otherId;
}

/**
 * Check if this record is present (persisted and not destroyed).
 *
 * Mirrors: ActiveRecord::Core#present?
 */
export function isPresent(this: CoreRecord): boolean {
  return this.isPersisted();
}

/**
 * Check if this record is blank (new record or destroyed).
 *
 * Mirrors: ActiveRecord::Core#blank?
 */
export function isBlank(this: CoreRecord): boolean {
  return !isPresent.call(this);
}

// ---------------------------------------------------------------------------
// Instance methods missing from api:compare
// ---------------------------------------------------------------------------

export function initWithAttributes(
  this: CoreRecord & { _attributes: any; _newRecord: boolean },
  attributes: any,
  newRecord = false,
): void {
  this._newRecord = newRecord;
  this._attributes = attributes;
}

export function initAttributes(this: CoreRecord): void {
  // Reset primary key attributes on the cloned attribute set
}

export function strictLoadingMode(
  this: CoreRecord & { _strictLoadingMode?: string },
): string | null {
  return this._strictLoadingMode ?? null;
}

export function isStrictLoadingNPlusOneOnly(
  this: CoreRecord & { _strictLoadingMode?: string },
): boolean {
  return this._strictLoadingMode === "n_plus_one_only";
}

export function isStrictLoadingAll(this: CoreRecord & { _strictLoadingMode?: string }): boolean {
  return this._strictLoadingMode === "all";
}

export function fullInspect(this: CoreRecord): string {
  return inspect.call(this);
}

// ---------------------------------------------------------------------------
// Class methods missing from api:compare
// ---------------------------------------------------------------------------

interface CoreHost {
  name: string;
  _filterAttributes?: string[];
  _inspectionFilter?: any;
  _connectionClass?: boolean;
  _destroyAssociationAsyncJob?: any;
  _findByStatementCache?: Map<boolean, Map<string, any>>;
  _generatedAssociationMethods?: Set<string>;
  _configurations?: any;
  prototype: any;
  superclass?: CoreHost;
}

export function destroyAssociationAsyncJob(this: CoreHost, value?: any): any {
  if (value !== undefined) {
    this._destroyAssociationAsyncJob = value;
  }
  return this._destroyAssociationAsyncJob ?? null;
}

export function configurations(this: CoreHost, config?: any): any {
  if (config !== undefined) {
    this._configurations = config;
  }
  return this._configurations ?? {};
}

export function isApplicationRecordClass(this: CoreHost): boolean {
  return this.name === "ApplicationRecord";
}

const _connectedToStack: Array<{
  role?: string;
  shard?: string;
  klasses: Set<any>;
  prevent_writes?: boolean;
}> = [];

export function connectedToStack(): typeof _connectedToStack {
  return _connectedToStack;
}

export function currentRole(this: CoreHost): string {
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.role) return entry.role;
  }
  return "writing";
}

export function currentShard(this: CoreHost): string {
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.shard) return entry.shard;
  }
  return "default";
}

export function currentPreventingWrites(this: CoreHost): boolean {
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.prevent_writes !== undefined) return entry.prevent_writes;
  }
  return false;
}

export function isPreventingWrites(this: CoreHost): boolean {
  return currentPreventingWrites.call(this);
}

export function connectionClass(this: CoreHost, value?: boolean): boolean {
  if (value !== undefined) {
    this._connectionClass = value;
  }
  return this._connectionClass ?? false;
}

export function isConnectionClass(this: CoreHost): boolean {
  return connectionClass.call(this);
}

export function connectionClassForSelf(this: CoreHost): CoreHost {
  let klass: CoreHost | undefined = this;
  while (klass && klass.name !== "Base") {
    if (klass._connectionClass) return klass;
    klass = klass.superclass;
  }
  return klass ?? this;
}

export function asynchronousQueriesSession(): null {
  return null;
}

export function asynchronousQueriesTracker(): { currentSession: null } {
  return { currentSession: null };
}

export function strictLoadingViolationBang(
  this: CoreHost,
  owner: string,
  association: string,
): never {
  throw new Error(
    `${owner} is marked for strict_loading. The ${association} association cannot be lazily loaded.`,
  );
}

export function initializeFindByCache(this: CoreHost): void {
  this._findByStatementCache = new Map();
  this._findByStatementCache.set(true, new Map());
  this._findByStatementCache.set(false, new Map());
}

export function initializeGeneratedModules(this: CoreHost): void {
  if (!this._generatedAssociationMethods) {
    this._generatedAssociationMethods = new Set();
  }
}

export function generatedAssociationMethods(this: CoreHost): Set<string> {
  if (!this._generatedAssociationMethods) {
    this._generatedAssociationMethods = new Set();
  }
  return this._generatedAssociationMethods;
}

export function filterAttributes(this: CoreHost, value?: string[]): string[] {
  if (value !== undefined) {
    this._filterAttributes = value;
    this._inspectionFilter = null;
  }
  if (this._filterAttributes) return this._filterAttributes;
  if (this.superclass?._filterAttributes) {
    return filterAttributes.call(this.superclass);
  }
  return [];
}

export function inspectionFilter(this: CoreHost): { filter(value: string): string } {
  if (this._inspectionFilter) return this._inspectionFilter;
  const attrs = filterAttributes.call(this);
  const attrSet = new Set(attrs);
  this._inspectionFilter = {
    filter(key: string): string {
      return attrSet.has(key) ? "[FILTERED]" : key;
    },
  };
  return this._inspectionFilter;
}

let _PredicateBuilder: any;

export function predicateBuilder(
  this: CoreHost & { arelTable?: any; _predicateBuilder?: any },
): any {
  if (!this._predicateBuilder) {
    if (!_PredicateBuilder) {
      // PredicateBuilder is always loaded before any model calls this
      _PredicateBuilder = (this as any).constructor._predicateBuilderClass;
    }
    if (_PredicateBuilder) {
      this._predicateBuilder = new _PredicateBuilder(this.arelTable);
    } else {
      return { table: this.arelTable };
    }
  }
  return this._predicateBuilder;
}

export function typeCaster(this: CoreHost): {
  typeCastForDatabase(attr: string, value: unknown): unknown;
} {
  return {
    typeCastForDatabase(_attr: string, value: unknown): unknown {
      return value;
    },
  };
}

export function cachedFindByStatement(
  this: CoreHost,
  _connection: any,
  key: string,
  block: () => any,
): any {
  if (!this._findByStatementCache) initializeFindByCache.call(this);
  const cache = this._findByStatementCache!.get(true)!;
  if (!cache.has(key)) {
    cache.set(key, block());
  }
  return cache.get(key);
}
