import type { Base } from "../base.js";

/**
 * Module-private marker: set on a reflection the first time the
 * validity check runs, so subsequent resolutions don't re-run
 * (cheap, idempotent — safety net only).
 */
const CHECKED = Symbol("ThroughReflection.checkedValidity");

/**
 * Run `ThroughReflection#checkValidityBang` at first use (Rails-
 * faithful: Rails' `Association#initialize` calls the same check).
 * Every Rails-named misconfiguration propagates — polymorphic
 * source without `source_type`, `source_type` without polymorphic
 * source, polymorphic-through, missing source, has-one through a
 * has-many collection, out-of-order reflection declaration, and
 * inverse-of misses.
 *
 * Called from `Association#constructor`, the top-level
 * `association(record, name)`, and the DJAS / JOIN-based loaders
 * so every entry point surfaces the error loudly. Memoized on the
 * reflection via a module-private symbol (per-instance; a
 * misconfiguration is stable until the reflection changes).
 *
 * Mirrors: `ActiveRecord::Reflection::ThroughReflection#check_validity!`
 * (activerecord/lib/active_record/reflection.rb:1140-1178).
 */
export function validateThroughReflection(modelClass: typeof Base, assocName: string): void {
  const full = (
    modelClass as unknown as { _reflectOnAssociation?: (n: string) => unknown }
  )._reflectOnAssociation?.(assocName);
  const refl = full as
    | {
        isThroughReflection?: () => boolean;
        checkValidityBang?: () => void;
        [CHECKED]?: boolean;
      }
    | null
    | undefined;
  if (!refl || refl[CHECKED]) return;
  // Only ThroughReflection has a `checkValidityBang`; non-through
  // reflections don't need the check.
  const isThrough = typeof refl.isThroughReflection === "function" && refl.isThroughReflection();
  if (!isThrough || typeof refl.checkValidityBang !== "function") return;

  // Delegate to `ThroughReflection#checkValidityBang` and let every
  // Rails-named misconfiguration surface. Mark as checked
  // regardless of outcome so a static misconfiguration doesn't
  // re-run on every first-use call; the outcome is stable until
  // the reflection changes.
  try {
    refl.checkValidityBang();
  } finally {
    refl[CHECKED] = true;
  }
}
