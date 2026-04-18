import type { Type } from "@blazetrails/activemodel";

/**
 * Shared contract for types that wrap an inner cast type (e.g.
 * encryption wrappers). Consumers — notably schema reflection in
 * `applyColumnsHash` — can preserve such wrappers across
 * adapter-resolved type changes by calling `withInnerType(newInner)`
 * without knowing the concrete class.
 *
 * Both EncryptedAttributeType variants implement this:
 *   - `packages/activerecord/src/encrypted-attribute-type.ts`
 *     (encryptor-based; used by `Base.encrypts()`)
 *   - `packages/activerecord/src/encryption/encrypted-attribute-type.ts`
 *     (scheme-based; used by `EncryptableRecord.encrypts()`)
 *
 * Future consolidation onto a single Rails-faithful class is tracked
 * in the attr-type-wiring follow-ups memory note.
 */
export interface WrappedType {
  withInnerType(innerType: Type): WrappedType;
}

/** Duck-typed predicate — narrows `t` to a `WrappedType`. */
export function isWrappedType(t: unknown): t is WrappedType {
  return (
    typeof t === "object" &&
    t !== null &&
    typeof (t as { withInnerType?: unknown }).withInnerType === "function"
  );
}
