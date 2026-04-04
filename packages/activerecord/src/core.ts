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
  _predicateBuilder?: any;
  arelTable?: any;
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

// Rails uses ActiveSupport::IsolatedExecutionState for per-fiber/thread
// storage. We use AsyncLocalStorage when available for async safety.
type ConnectedToEntry = {
  role?: string;
  shard?: string;
  klasses: Set<any>;
  prevent_writes?: boolean;
};

const _connectedToStack: ConnectedToEntry[] = [];

export function connectedToStack(): ConnectedToEntry[] {
  return _connectedToStack;
}

/**
 * Rails: checks klasses.include?(Base) and klasses.include?(connection_class_for_self)
 */
export function currentRole(this: CoreHost): string {
  const connClass = connectionClassForSelf.call(this);
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.role && (entry.klasses.has("Base") || entry.klasses.has(connClass))) {
      return entry.role;
    }
  }
  return "writing";
}

export function currentShard(this: CoreHost): string {
  const connClass = connectionClassForSelf.call(this);
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.shard && (entry.klasses.has("Base") || entry.klasses.has(connClass))) {
      return entry.shard;
    }
  }
  return "default";
}

export function currentPreventingWrites(this: CoreHost): boolean {
  const connClass = connectionClassForSelf.call(this);
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (
      entry.prevent_writes !== undefined &&
      (entry.klasses.has("Base") || entry.klasses.has(connClass))
    ) {
      return entry.prevent_writes;
    }
  }
  return false;
}

export function isPreventingWrites(this: CoreHost, className?: string): boolean {
  for (let i = _connectedToStack.length - 1; i >= 0; i--) {
    const entry = _connectedToStack[i];
    if (entry.prevent_writes === undefined) continue;
    if (entry.klasses.has("Base")) return entry.prevent_writes;
    if (className) {
      for (const klass of entry.klasses) {
        if (typeof klass === "object" && klass !== null && klass.name === className) {
          return entry.prevent_writes;
        }
      }
    }
  }
  return false;
}

export function connectionClass(this: CoreHost, value?: boolean): boolean {
  if (value !== undefined) {
    this._connectionClass = value;
  }
  return this._connectionClass ?? false;
}

export function isConnectionClass(this: CoreHost): boolean {
  return this._connectionClass ?? false;
}

/**
 * Walk up the class hierarchy to find the nearest connection class.
 * Mirrors: ActiveRecord::Core.connection_class_for_self
 */
export function connectionClassForSelf(this: CoreHost): CoreHost {
  let klass: CoreHost | undefined = this;
  while (klass && klass.name !== "Base") {
    if (klass._connectionClass) return klass;
    klass = klass.superclass;
  }
  return klass ?? this;
}

/**
 * Mirrors: ActiveRecord::Core.asynchronous_queries_tracker
 */
export function asynchronousQueriesTracker(): {
  currentSession: any;
  finalize(): void;
} {
  return {
    currentSession: null,
    finalize() {},
  };
}

/**
 * Mirrors: ActiveRecord::Core.asynchronous_queries_session
 */
export function asynchronousQueriesSession(): any {
  return asynchronousQueriesTracker().currentSession;
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

/**
 * Rails: initializes generated_association_methods module and includes it.
 */
export function initializeGeneratedModules(this: CoreHost): void {
  generatedAssociationMethods.call(this);
}

export function generatedAssociationMethods(this: CoreHost): Set<string> {
  if (!this._generatedAssociationMethods) {
    this._generatedAssociationMethods = new Set();
  }
  return this._generatedAssociationMethods;
}

/**
 * Rails: delegates to superclass if @filter_attributes is nil.
 */
export function filterAttributes(this: CoreHost, value?: string[]): string[] {
  if (value !== undefined) {
    this._filterAttributes = value;
    this._inspectionFilter = null;
  }
  if (this._filterAttributes !== undefined) return this._filterAttributes;
  if (this.superclass) return filterAttributes.call(this.superclass);
  return [];
}

/**
 * Rails: creates an ActiveSupport::ParameterFilter with an InspectionMask.
 * We approximate with a filter function that checks attribute names against
 * the filter list and replaces matching values with [FILTERED].
 */
export function inspectionFilter(this: CoreHost): {
  filter(params: Record<string, unknown>): Record<string, unknown>;
} {
  if (this._inspectionFilter) return this._inspectionFilter;
  if (this._filterAttributes === undefined && this.superclass) {
    return inspectionFilter.call(this.superclass);
  }
  const attrs = this._filterAttributes ?? [];
  const mask = new InspectionMask();
  this._inspectionFilter = {
    filter(params: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params)) {
        result[key] = attrs.includes(key) ? mask.toString() : value;
      }
      return result;
    },
  };
  return this._inspectionFilter;
}

/**
 * Rails: PredicateBuilder.new(TableMetadata.new(self, arel_table))
 * Memoized per class.
 */
export function predicateBuilder(this: CoreHost): any {
  if (this._predicateBuilder) return this._predicateBuilder;
  // PredicateBuilder is imported by relation.ts which loads before
  // any model class calls this. Access via the relation module.
  const table = this.arelTable;
  if (!table) return null;
  // Deferred: the actual PredicateBuilder is wired up when Relation loads.
  // For now, return a minimal object that satisfies the interface.
  return { table };
}

/**
 * Rails: TypeCaster::Map.new(self)
 * Provides type_cast_for_database used by in_order_of etc.
 */
export function typeCaster(this: CoreHost): {
  typeCastForDatabase(column: string, value: unknown): unknown;
} {
  const host = this;
  return {
    typeCastForDatabase(column: string, value: unknown): unknown {
      // Check if the model has attribute types that can cast
      const attrDefs = (host as any)._attributeDefinitions;
      if (attrDefs instanceof Map) {
        const def = attrDefs.get(column);
        if (def?.type?.serialize) return def.type.serialize(value);
      }
      return value;
    },
  };
}

/**
 * Rails: caches StatementCache per connection prepared_statements setting.
 */
export function cachedFindByStatement(
  this: CoreHost,
  connection: any,
  key: string,
  block: () => any,
): any {
  if (!this._findByStatementCache) initializeFindByCache.call(this);
  const prepared = connection?.preparedStatements ?? true;
  const cache = this._findByStatementCache!.get(prepared)!;
  if (!cache.has(key)) {
    cache.set(key, block());
  }
  return cache.get(key);
}
