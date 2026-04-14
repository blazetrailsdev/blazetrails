/**
 * Mirrors: ActiveRecord::DatabaseConfigurations::DatabaseConfig
 *
 * Abstract base class for database configuration objects.
 * Concrete subclasses (HashConfig, UrlConfig) implement the accessor methods.
 */

export interface DatabaseConfigOptions {
  adapter?: string;
  database?: string;
  host?: string;
  port?: number;
  socket?: string;
  username?: string;
  password?: string;
  encoding?: string;
  pool?: number;
  minThreads?: number;
  maxThreads?: number;
  checkoutTimeout?: number;
  idleTimeout?: number | null;
  reapingFrequency?: number | null;
  queryCache?: boolean | "enabled" | "disabled";
  migrationsPaths?: string | string[];
  schemaCachePath?: string;
  schemaDump?: string | false;
  databaseTasks?: boolean;
  useMetadataTable?: boolean;
  seeds?: boolean;
  url?: string;
  replicaOf?: string;
  replica?: boolean;
  _hidden?: boolean;
  [key: string]: unknown;
}

let _defaultEnvGetter: (() => string) | null = null;

/** @internal Set by DatabaseConfigurations to break circular dependency */
export function _setDefaultEnvGetter(fn: () => string): void {
  _defaultEnvGetter = fn;
}

/**
 * Mirrors: ActiveRecord::DatabaseConfigurations::DatabaseConfig
 */
export class DatabaseConfig {
  readonly envName: string;
  readonly name: string;
  readonly configuration: DatabaseConfigOptions;

  constructor(envName: string, name: string, configuration: DatabaseConfigOptions = {}) {
    this.envName = envName;
    this.name = name;
    this.configuration = configuration;
  }

  /**
   * Mirrors: DatabaseConfig#configuration_hash
   *
   * Alias for configuration — Rails uses configuration_hash as the canonical
   * accessor on HashConfig.
   */
  get configurationHash(): DatabaseConfigOptions {
    return this.configuration;
  }

  /**
   * Mirrors: DatabaseConfig#inspect
   */
  inspect(): string {
    return `#<${this.constructor.name} env_name=${this.envName} name=${this.name} adapter=${this.adapter}>`;
  }

  /**
   * Mirrors: DatabaseConfig#for_current_env?
   */
  get forCurrentEnv(): boolean {
    const defaultEnv = _defaultEnvGetter ? _defaultEnvGetter() : "development";
    return this.envName === defaultEnv;
  }

  // --- Accessors (implemented in HashConfig, stubbed here for the type contract) ---

  get adapter(): string | undefined {
    return this.configuration.adapter;
  }

  get database(): string | undefined {
    return this.configuration.database;
  }

  /**
   * Mirrors: DatabaseConfig#_database=
   *
   * Internal setter for the database name. Rails exposes this so things like
   * db:create can swap the database without creating a new config.
   */
  set _database(database: string) {
    (this.configuration as Record<string, unknown>).database = database;
  }

  /**
   * Mirrors: DatabaseConfig#seeds?
   *
   * Abstract on DatabaseConfig — HashConfig overrides with real logic.
   */
  get seeds(): boolean {
    return false;
  }

  get host(): string | undefined {
    return this.configuration.host;
  }

  get socket(): string | undefined {
    return this.configuration.socket;
  }

  get pool(): number {
    return Number(this.configuration.pool ?? 5);
  }

  get minThreads(): number {
    return Number(this.configuration.minThreads ?? 0);
  }

  get maxThreads(): number {
    return Number(this.configuration.maxThreads ?? this.pool);
  }

  get maxQueue(): number {
    return this.maxThreads * 4;
  }

  get checkoutTimeout(): number {
    return Number(this.configuration.checkoutTimeout ?? 5);
  }

  get idleTimeout(): number | null {
    const raw = this.configuration.idleTimeout;
    if (raw === null) return null;
    const timeout = raw === undefined ? 300 : Number(raw);
    return timeout > 0 ? timeout : null;
  }

  get reapingFrequency(): number | null {
    const raw = this.configuration.reapingFrequency;
    if (raw === null) return null;
    const freq = raw === undefined ? 60 : Number(raw);
    return freq > 0 ? freq : null;
  }

  get queryCache(): unknown {
    return this.configuration.queryCache;
  }

  get replica(): boolean {
    return this.configuration.replica === true;
  }

  get migrationsPaths(): string | string[] | undefined {
    return this.configuration.migrationsPaths;
  }

  get schemaCachePath(): string | undefined {
    return this.configuration.schemaCachePath;
  }

  get useMetadataTable(): boolean {
    const val = this.configuration.useMetadataTable;
    return val === undefined ? true : !!val;
  }

  // --- Adapter resolution (Rails uses ActiveRecord::ConnectionAdapters.resolve) ---
  // Not implemented here because adapter resolution in this codebase goes
  // through Base.adapter (set per model class) rather than a global registry.

  /**
   * Mirrors: DatabaseConfig#validate!
   *
   * Validates the configuration. In Rails this attempts to resolve the
   * adapter class; here we just check that an adapter is specified.
   */
  validateBang(): true {
    if (!this.adapter) {
      throw new Error(`Database configuration missing adapter: ${this.inspect()}`);
    }
    return true;
  }
}
