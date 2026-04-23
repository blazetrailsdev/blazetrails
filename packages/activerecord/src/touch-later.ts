import type { Base } from "./base.js";
import { ActiveRecordError } from "./errors.js";
import {
  touch as timestampTouch,
  timestampAttributesForUpdateInModel,
  currentTimeFromProperTimezone,
} from "./timestamp.js";
import { reflectOnAllAssociations } from "./reflection.js";
import { BelongsTo as BelongsToBuilder } from "./associations/builder/belongs-to.js";
import { HasOne as HasOneBuilder } from "./associations/builder/has-one.js";
import { beforeCommittedBang as transactionsBeforeCommittedBang } from "./transactions.js";
import { isAppliedTo as isNoTouchingApplied } from "./no-touching.js";

/**
 * Deferred-touch mixin.
 *
 * When called inside a transaction, `touchLater` writes timestamp attrs
 * in-memory (without marking dirty) and defers the DB UPDATE to
 * `beforeCommitted!`, which fires just before the transaction commits.
 *
 * Mirrors: ActiveRecord::TouchLater
 */

function raiseRecordNotTouchedError(): never {
  throw new ActiveRecordError(
    "Cannot touch on a new or destroyed record object. Consider using " +
      "persisted?, new_record?, or destroyed? before touching.",
  );
}

/**
 * Defer touching timestamp columns until before_committed!.
 * Writes values in-memory immediately without marking dirty so associations
 * that read the attribute see the updated time before the commit.
 *
 * Mirrors: ActiveRecord::TouchLater#touch_later
 */
export async function touchLater(this: Base, ...names: string[]): Promise<void> {
  if (!this.isPersisted()) raiseRecordNotTouchedError();
  if (isNoTouchingApplied(this.constructor as typeof Base)) return;

  const ctor = this.constructor as typeof Base;
  const self = this as any;

  if (!self._deferTouchAttrs) {
    self._deferTouchAttrs = [...(timestampAttributesForUpdateInModel.call(ctor) as string[])];
  }

  if (names.length > 0) {
    const aliases: Record<string, string> = (ctor as any)._attributeAliases ?? {};
    for (const name of names) {
      const resolved = aliases[name] ?? name;
      if (!self._deferTouchAttrs.includes(resolved)) self._deferTouchAttrs.push(resolved);
    }
  }

  self._touchTime = currentTimeFromProperTimezone();
  surreptitouslyTouch(this, self._deferTouchAttrs as string[], self._touchTime as Date);

  // Touch belongs_to / has_one parents that have touch: option — mirrors the
  // reflect_on_all_associations loop in Rails' touch_later.
  for (const r of reflectOnAllAssociations(ctor)) {
    const touch = r.options?.touch;
    if (!touch) continue;
    if (r.macro === "belongsTo") {
      await BelongsToBuilder.touchRecord(
        this,
        (this as any).changesToSave ?? {},
        r.foreignKey ?? r.options?.foreignKey,
        r.name,
        touch,
      );
    } else if (r.macro === "hasOne") {
      await (HasOneBuilder as any).touchRecord?.(this, r.name, touch);
    }
  }
}

/**
 * If deferred attrs are pending, merge them into the normal touch call so they
 * all flush in a single UPDATE, then clear deferred state.
 *
 * Mirrors: ActiveRecord::TouchLater#touch
 */
export async function touch(this: Base, ...names: string[]): Promise<boolean> {
  const self = this as any;
  if (self._deferTouchAttrs?.length) {
    const merged: string[] = [...new Set([...names, ...(self._deferTouchAttrs as string[])])];
    self._deferTouchAttrs = null;
    self._touchTime = null;
    return timestampTouch.call(this, ...merged);
  }
  return timestampTouch.call(this, ...names);
}

/**
 * Flush deferred touch attrs before the record's transaction commits,
 * then run before_commit callbacks (super).
 *
 * Mirrors: ActiveRecord::TouchLater#before_committed!
 */
export async function beforeCommittedBang(this: Base): Promise<void> {
  const self = this as any;
  if (self._deferTouchAttrs?.length && this.isPersisted()) {
    await touchDeferredAttributes(this);
  }
  await transactionsBeforeCommittedBang(this);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function surreptitouslyTouch(record: Base, attrNames: string[], time: Date): void {
  for (const attr of attrNames) {
    (record as any).writeAttribute(attr, time);
    if (typeof (record as any).clearAttributeChanges === "function") {
      (record as any).clearAttributeChanges([attr]);
    }
  }
}

async function touchDeferredAttributes(record: Base): Promise<void> {
  const self = record as any;
  const time: Date = self._touchTime ?? new Date();

  // Build attrs from all deferred columns, preserving the exact timestamp
  // set at touchLater time — mirrors touch(time: @_touch_time) in Rails.
  const attrs: Record<string, unknown> = {};
  for (const attr of self._deferTouchAttrs as string[]) attrs[attr] = time;

  self._deferTouchAttrs = null;
  self._touchTime = null;

  await record.updateColumns(attrs);
}

export const InstanceMethods = {
  touchLater,
  touch,
  beforeCommittedBang,
};
