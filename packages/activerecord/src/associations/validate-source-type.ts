import type { Base } from "../base.js";
import {
  HasManyThroughAssociationPointlessSourceTypeError,
  HasManyThroughAssociationPolymorphicSourceError,
} from "./errors.js";

/**
 * Module-private marker: set on a reflection the first time the
 * sourceType validation succeeds, so subsequent resolutions don't
 * re-run (cheap, idempotent — safety net only).
 */
const CHECKED = Symbol("ThroughReflection.checkedSourceType");

/**
 * Validate the two sourceType-shape constraints Rails enforces in
 * `ThroughReflection#check_validity!`:
 *
 *   - polymorphic source without `source_type`
 *     → `HasManyThroughAssociationPolymorphicSourceError`
 *   - `source_type` with a non-polymorphic source
 *     → `HasManyThroughAssociationPointlessSourceTypeError`
 *
 * Either misconfiguration produces invalid SQL downstream:
 * reflection.ts#_collectJoinReflections injects a `PolymorphicReflection`
 * when `options.sourceType` is set, and its `foreignType` is `null`
 * unless the source reflection is actually polymorphic
 * (reflection.ts:544). The polymorphic-source-without-source_type
 * case has no type filter, so the chain-walker mixes ids across
 * polymorphic target tables.
 *
 * Called from `Association#constructor` (matching Rails'
 * `Association#initialize → reflection.check_validity!` hook) and
 * from `association(record, name)` so both entry points surface
 * the error loudly at first use. Results are memoized on the
 * reflection via a module-private symbol.
 *
 * Mirrors: `ActiveRecord::Reflection::ThroughReflection#check_validity!`
 * (activerecord/lib/active_record/reflection.rb:1157-1163).
 */
export function validateThroughSourceType(modelClass: typeof Base, assocName: string): void {
  const full = (
    modelClass as unknown as { _reflectOnAssociation?: (n: string) => unknown }
  )._reflectOnAssociation?.(assocName);
  const refl = full as
    | {
        isThroughReflection?: () => boolean;
        options?: { sourceType?: unknown };
        sourceReflection?: { isPolymorphic?: () => boolean; name?: string };
        name?: string;
        activeRecord?: { name?: string };
        [CHECKED]?: boolean;
      }
    | null
    | undefined;
  if (!refl || refl[CHECKED]) return;
  // AssociationReflection.sourceReflection returns `this`
  // (reflection.ts:793), so non-through polymorphic belongsTo would
  // misfire here. Gate on `isThroughReflection`.
  const isThrough = typeof refl.isThroughReflection === "function" && refl.isThroughReflection();
  if (!isThrough || !refl.sourceReflection || !refl.options) return;

  const srcPoly =
    typeof refl.sourceReflection.isPolymorphic === "function"
      ? refl.sourceReflection.isPolymorphic()
      : false;
  const hasSourceType = refl.options.sourceType != null;
  if (hasSourceType && !srcPoly) {
    throw new HasManyThroughAssociationPointlessSourceTypeError(
      refl.activeRecord?.name ?? "<unknown>",
      refl.name ?? "<unknown>",
      refl.sourceReflection.name ?? "<unknown>",
    );
  }
  if (srcPoly && !hasSourceType) {
    throw new HasManyThroughAssociationPolymorphicSourceError(
      refl.activeRecord?.name ?? "<unknown>",
      refl.name ?? "<unknown>",
      refl.sourceReflection.name ?? "<unknown>",
    );
  }
  refl[CHECKED] = true;
}
