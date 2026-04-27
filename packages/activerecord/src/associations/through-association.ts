import type { Base } from "../base.js";

/**
 * Shared module for through associations (has_many :through, has_one :through).
 * These helpers mirror the private/protected methods in Rails'
 * ActiveRecord::Associations::ThroughAssociation module.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation
 */

function transaction(
  assoc: { owner: Base; reflection: any },
  block: () => Promise<void>,
): Promise<void> {
  const throughKlass = assoc.reflection.options.through
    ? (assoc.owner.constructor as any)._reflectOnAssociation?.(assoc.reflection.options.through)
        ?.klass
    : null;
  if (throughKlass && typeof throughKlass.transaction === "function") {
    return throughKlass.transaction(block);
  }
  return block();
}

function throughReflection(assoc: { owner: Base; reflection: any }): unknown {
  let refl = assoc.reflection.throughReflection?.();
  if (!refl) {
    const throughName = assoc.reflection.options.through;
    const ctor = assoc.owner.constructor as any;
    refl = ctor._reflectOnAssociation?.(throughName) ?? null;
  }
  return refl;
}

function throughAssociation(assoc: { owner: Base; reflection: any }): unknown {
  const tr = throughReflection(assoc) as any;
  if (tr) return (assoc.owner as any).association?.(tr.name ?? assoc.reflection.options.through);
  return null;
}

function constructJoinAttributes(
  assoc: { owner: Base; reflection: any },
  ...records: Base[]
): Record<string, unknown> {
  const sourceRefl = assoc.reflection.sourceReflection?.() as any;
  if (!sourceRefl) return {};
  if (records.length === 1) {
    return { [sourceRefl.name]: records[0] };
  }
  return { [sourceRefl.foreignKey as string]: records.map((r: any) => r.id) };
}

function ensureMutable(assoc: { owner: Base; reflection: any }): void {
  const sourceRefl = assoc.reflection.sourceReflection?.() as any;
  if (sourceRefl && sourceRefl.macro !== "belongsTo") {
    throw new Error(
      `Cannot modify association '${assoc.reflection.name}': ` +
        `through associations with a non-belongs-to source are read-only.`,
    );
  }
}

function ensureNotNested(assoc: { owner: Base; reflection: any }): void {
  if (assoc.reflection.options.through) {
    const throughRefl = (assoc.owner.constructor as any)._reflectOnAssociation?.(
      assoc.reflection.options.through,
    );
    if (throughRefl?.options?.through) {
      throw new Error(`Nested through associations are read-only.`);
    }
  }
}
