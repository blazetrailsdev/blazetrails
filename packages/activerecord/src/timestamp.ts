import type { Base } from "./base.js";
import { ReadOnlyRecord, StaleObjectError } from "./errors.js";
import { UpdateManager, Nodes } from "@blazetrails/arel";

/**
 * Timestamp handling for ActiveRecord models.
 *
 * Mirrors: ActiveRecord::Timestamp
 */

/**
 * Update the updated_at timestamp (and optionally other timestamp
 * columns) without changing other attributes. Skips validations
 * and callbacks (except after_touch).
 *
 * Mirrors: ActiveRecord::Timestamp#touch
 */
export async function touch(this: Base, ...names: string[]): Promise<boolean> {
  if (this.isReadonly()) {
    throw new ReadOnlyRecord(`${this.constructor.name} is marked as readonly`);
  }
  if (!this.isPersisted()) return false;
  const now = new Date();

  const ctor = this.constructor as typeof Base;
  const touchCols: string[] = [];
  if (ctor._attributeDefinitions.has("updated_at")) {
    touchCols.push("updated_at");
  }
  for (const name of names) {
    if (ctor._attributeDefinitions.has(name)) touchCols.push(name);
  }

  if (touchCols.length === 0) return false;

  // Build a targeted UPDATE directly — mirrors Rails' _touch_row → _update_row.
  // Does NOT run save callbacks (before_save / after_save), only after_touch.
  const table = ctor.arelTable;
  const setPairs: [InstanceType<typeof Nodes.Node>, unknown][] = touchCols.map((col) => [
    table.get(col) as InstanceType<typeof Nodes.Node>,
    new Nodes.Quoted(now),
  ]);

  // Write new values via writeAttribute to register them as dirty changes
  // so changesApplied() can populate previousChanges (saved_changes).
  for (const col of touchCols) {
    this.writeAttribute(col, now);
  }

  // Optimistic locking: include lock_version increment and stale-object check.
  const lockCol = ctor.lockingColumn;
  let rawVersion: unknown;
  if (ctor.lockingEnabled) {
    rawVersion = this.readAttribute(lockCol);
    const current = rawVersion == null ? 0 : Number(rawVersion) || 0;
    const next = current + 1;
    setPairs.push([table.get(lockCol) as InstanceType<typeof Nodes.Node>, new Nodes.Quoted(next)]);
    this.writeAttribute(lockCol, next);
  }

  const um = new UpdateManager()
    .table(table)
    .set(setPairs)
    .where((ctor as any)._buildPkWhereNode(this.id));

  if (ctor.lockingEnabled) {
    if (rawVersion == null) {
      um.where(table.get(lockCol).isNull());
    } else {
      um.where(table.get(lockCol).eq(Number(rawVersion) || 0));
    }
  }

  const affected = await ctor.adapter.execUpdate(um.toSql(), `${ctor.name} Touch`);
  if (ctor.lockingEnabled && affected === 0) {
    throw new StaleObjectError(this, "touch");
  }

  this.changesApplied();

  await ctor._callbackChain.runAfter("touch", this);
  return true;
}

/**
 * Touch all records matching the current scope.
 *
 * Mirrors: ActiveRecord::Base.touch_all
 */
export async function touchAll(this: typeof Base, ...names: string[]): Promise<number> {
  return this.all().touchAll(...names);
}

// ---------------------------------------------------------------------------
// Class methods — mirrors ActiveRecord::Timestamp::ClassMethods
// ---------------------------------------------------------------------------

const CREATED_ATTRS = ["created_at", "created_on"];
const UPDATED_ATTRS = ["updated_at", "updated_on"];

interface TimestampHost {
  _attributeAliases?: Record<string, string>;
  columnNames?: string[] | (() => string[]);
  _timestampAttributesForCreateInModel?: string[];
  _timestampAttributesForUpdateInModel?: string[];
  _allTimestampAttributesInModel?: string[];
}

export function touchAttributesWithTime(
  this: TimestampHost,
  ...names: string[]
): Record<string, Date> {
  const time = currentTimeFromProperTimezone();
  const resolved = names.map((n) => this._attributeAliases?.[n] ?? n);
  const updateAttrs = timestampAttributesForUpdateInModel.call(this);
  const allNames = [...new Set([...updateAttrs, ...resolved])];
  const result: Record<string, Date> = {};
  for (const name of allNames) result[name] = time;
  return result;
}

export function timestampAttributesForCreateInModel(this: TimestampHost): string[] {
  if (this._timestampAttributesForCreateInModel) return this._timestampAttributesForCreateInModel;
  const names =
    typeof this.columnNames === "function" ? this.columnNames() : (this.columnNames ?? []);
  const cols = new Set(names);
  this._timestampAttributesForCreateInModel = CREATED_ATTRS.filter((a) => cols.has(a));
  return this._timestampAttributesForCreateInModel;
}

export function timestampAttributesForUpdateInModel(this: TimestampHost): string[] {
  if (this._timestampAttributesForUpdateInModel) return this._timestampAttributesForUpdateInModel;
  const names =
    typeof this.columnNames === "function" ? this.columnNames() : (this.columnNames ?? []);
  const cols = new Set(names);
  this._timestampAttributesForUpdateInModel = UPDATED_ATTRS.filter((a) => cols.has(a));
  return this._timestampAttributesForUpdateInModel;
}

export function allTimestampAttributesInModel(this: TimestampHost): string[] {
  if (this._allTimestampAttributesInModel) return this._allTimestampAttributesInModel;
  this._allTimestampAttributesInModel = [
    ...timestampAttributesForCreateInModel.call(this),
    ...timestampAttributesForUpdateInModel.call(this),
  ];
  return this._allTimestampAttributesInModel;
}

export function currentTimeFromProperTimezone(): Date {
  return new Date();
}

/**
 * Module methods wired onto Base as static methods via `extend()` in base.ts.
 * Mirrors Rails' `ActiveSupport::Concern#ClassMethods` convention.
 */
export const ClassMethods = {
  touchAll,
};

/**
 * Instance methods wired onto Base.prototype via `include()` in base.ts.
 */
export const InstanceMethods = {
  touch,
};
