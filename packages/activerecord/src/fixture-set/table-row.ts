/**
 * Table row — processes a single fixture row and assigns a deterministic
 * primary key when one is not provided.
 *
 * Mirrors: ActiveRecord::FixtureSet::TableRow
 */

import { identify } from "./file.js";

export class PrimaryKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrimaryKeyError";
  }
}

/**
 * Mirrors: ActiveRecord::FixtureSet::TableRow::ReflectionProxy
 */
export class ReflectionProxy {
  readonly name: string;
  readonly foreignKey: string;
  readonly className: string;

  constructor(name: string, foreignKey: string, className: string) {
    this.name = name;
    this.foreignKey = foreignKey;
    this.className = className;
  }
}

/**
 * Mirrors: ActiveRecord::FixtureSet::TableRow::HasManyThroughProxy
 */
export class HasManyThroughProxy extends ReflectionProxy {
  readonly through: string;
  readonly sourceReflection: ReflectionProxy;

  constructor(
    name: string,
    foreignKey: string,
    className: string,
    through: string,
    sourceReflection: ReflectionProxy,
  ) {
    super(name, foreignKey, className);
    this.through = through;
    this.sourceReflection = sourceReflection;
  }
}

/**
 * Mirrors: ActiveRecord::FixtureSet::TableRow
 */
export class TableRow {
  static readonly PrimaryKeyError = PrimaryKeyError;
  static readonly ReflectionProxy = ReflectionProxy;
  static readonly HasManyThroughProxy = HasManyThroughProxy;

  readonly label: string;
  private _row: Record<string, unknown>;
  private _primaryKey: string;

  constructor(label: string, row: Record<string, unknown>, options: { primaryKey?: string } = {}) {
    this.label = label;
    this._row = { ...row };
    this._primaryKey = options.primaryKey ?? "id";

    if (this._row[this._primaryKey] == null) {
      this._row[this._primaryKey] = identify(label);
    }
  }

  get row(): Record<string, unknown> {
    return { ...this._row };
  }

  get primaryKeyValue(): unknown {
    return this._row[this._primaryKey];
  }
}
