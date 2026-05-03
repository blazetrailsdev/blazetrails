import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { HasOneAssociation } from "./has-one-association.js";

/**
 * Mirrors: ActiveRecord::Associations::HasOneThroughAssociation
 */
export class HasOneThroughAssociation extends HasOneAssociation {
  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }
}

/** @internal */
async function createThroughRecord(
  assoc: HasOneThroughAssociation,
  record: Base | null,
  save: boolean,
): Promise<Base | null> {
  ensureNotNestedThrough(assoc);

  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return null;
  const throughProxy = (assoc.owner as any).association?.(throughName);
  if (!throughProxy) return null;

  const throughRecord = await throughProxy.loadTarget?.();

  if (throughRecord && !record) {
    await (throughRecord as any).destroy?.();
    return null;
  }

  if (record) {
    const attrs = buildJoinAttributes(assoc, record);

    if (throughRecord) {
      if ((throughRecord as any).isNewRecord?.()) {
        await (throughRecord as any).assignAttributes?.(attrs);
      } else {
        await (throughRecord as any).update?.(attrs);
      }
    } else if ((assoc.owner as any).isNewRecord?.() || !save) {
      throughProxy.build?.(attrs);
    } else {
      await throughProxy.create?.(attrs);
    }
  }
  return record;
}

function ensureNotNestedThrough(assoc: { reflection: any; owner: Base }): void {
  if (assoc.reflection.options.through) {
    const throughRefl = (assoc.owner.constructor as any)._reflectOnAssociation?.(
      assoc.reflection.options.through,
    );
    if (throughRefl?.options?.through) {
      throw new Error(`Nested through associations are read-only.`);
    }
  }
}

function buildJoinAttributes(
  assoc: { owner: Base; reflection: any },
  record: Base,
): Record<string, unknown> {
  const refl = assoc.reflection as any;
  const sourceRefl = refl.sourceReflection?.() as any;
  if (!sourceRefl) return {};
  const assocPk = sourceRefl.associationPrimaryKey?.(refl.klass) ?? sourceRefl.primaryKey ?? "id";
  const pkArr: string[] = Array.isArray(assocPk) ? assocPk : [assocPk];
  const compositeConstraints: string[] = refl.klass?.compositeQueryConstraintsList ?? [];

  let joinAttributes: Record<string, unknown>;
  if (
    pkArr.length === compositeConstraints.length &&
    pkArr.every((k: string, i: number) => k === compositeConstraints[i]) &&
    !refl.options?.sourceType
  ) {
    joinAttributes = { [sourceRefl.name]: record };
  } else {
    const fk: string = sourceRefl.foreignKey ?? `${sourceRefl.name}_id`;
    const pkVal =
      pkArr.length === 1
        ? ((record as any).readAttribute?.(pkArr[0]) ?? (record as any).id)
        : pkArr.map((k: string) => (record as any).readAttribute?.(k));
    joinAttributes = { [fk]: pkVal };
  }

  if (refl.options?.sourceType) {
    const foreignType: string = sourceRefl.foreignType ?? `${sourceRefl.name}_type`;
    joinAttributes[foreignType] = refl.options.sourceType;
  }
  return joinAttributes;
}

/**
 * Wrap `block` in a transaction on the through-reflection's class. Falls
 * back to invoking the block directly when no through klass is available.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#transaction
 *
 * @internal
 */
function transaction(assoc: HasOneThroughAssociation, block: () => Promise<void>): Promise<void> {
  const throughName = assoc.reflection.options.through as string | undefined;
  const ctor = assoc.owner.constructor as { _reflectOnAssociation?: (n: string) => unknown };
  const throughKlass = throughName
    ? ((ctor._reflectOnAssociation?.(throughName) as { klass?: { transaction?: Function } } | null)
        ?.klass ?? null)
    : null;
  if (throughKlass && typeof throughKlass.transaction === "function") {
    return throughKlass.transaction(block);
  }
  return block();
}

/**
 * Resolves the AssociationReflection for the `:through` join model.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#through_reflection
 *
 * @internal
 */
function throughReflection(assoc: HasOneThroughAssociation): unknown {
  const refl = assoc.reflection as {
    throughReflection?: () => unknown;
    options: { through?: string };
  };
  const direct = refl.throughReflection?.();
  if (direct) return direct;
  const throughName = refl.options.through;
  if (!throughName) return null;
  const ctor = assoc.owner.constructor as { _reflectOnAssociation?: (n: string) => unknown };
  return ctor._reflectOnAssociation?.(throughName) ?? null;
}

/**
 * Returns the live Association wrapper that owns the join model — i.e.,
 * `owner.association(throughReflection.name)`.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#through_association
 *
 * @internal
 */
function throughAssociation(assoc: HasOneThroughAssociation): unknown {
  const tr = throughReflection(assoc) as { name?: string } | null;
  if (!tr?.name) return null;
  return (assoc.owner as unknown as { association?: (n: string) => unknown }).association?.(
    tr.name,
  );
}

/**
 * Build the join-table attribute hash pairing `record` with the owner via
 * the source reflection's foreign key (or the source association name when
 * the join is composite-keyed). Used when constructing through records.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#construct_join_attributes
 *
 * @internal
 */
function constructJoinAttributes(
  assoc: HasOneThroughAssociation,
  ...records: Base[]
): Record<string, unknown> {
  ensureMutable(assoc);
  const refl = assoc.reflection as any;
  const sourceRefl = refl.sourceReflection?.() as any;
  if (!sourceRefl) return {};
  const assocPk = sourceRefl.associationPrimaryKey?.(refl.klass) ?? sourceRefl.primaryKey ?? "id";
  const pkArr: string[] = Array.isArray(assocPk) ? assocPk : [assocPk];
  const compositeConstraints: string[] = refl.klass?.compositeQueryConstraintsList ?? [];

  let joinAttributes: Record<string, unknown>;
  if (
    pkArr.length === compositeConstraints.length &&
    pkArr.every((k: string, i: number) => k === compositeConstraints[i]) &&
    !refl.options?.sourceType
  ) {
    joinAttributes = { [sourceRefl.name]: records.length === 1 ? records[0] : records };
  } else {
    const fk: string = sourceRefl.foreignKey ?? `${sourceRefl.name}_id`;
    const values = records.map((r: any) =>
      pkArr.length === 1
        ? (r.readAttribute?.(pkArr[0]) ?? r.id)
        : pkArr.map((k: string) => r.readAttribute?.(k)),
    );
    joinAttributes = { [fk]: records.length === 1 ? values[0] : values };
  }

  if (refl.options?.sourceType) {
    const foreignType: string = sourceRefl.foreignType ?? `${sourceRefl.name}_type`;
    joinAttributes[foreignType] =
      records.length === 1 ? refl.options.sourceType : [refl.options.sourceType];
  }
  return joinAttributes;
}

/**
 * Throws when the source reflection is not a `belongsTo` — through
 * associations with a non-belongsTo source are read-only because mutating
 * the source side isn't well-defined.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#ensure_mutable
 *
 * @internal
 */
function ensureMutable(assoc: HasOneThroughAssociation): void {
  const sourceRefl = (assoc.reflection as any).sourceReflection?.() as { macro?: string } | null;
  if (sourceRefl && sourceRefl.macro !== "belongsTo") {
    throw new Error(
      `Cannot modify association '${assoc.reflection.name}': through associations with a non-belongs-to source are read-only.`,
    );
  }
}

/**
 * Throws when this through-association points at another through-association
 * (a "nested through"). Rails treats nested-through chains as read-only.
 *
 * Mirrors: ActiveRecord::Associations::ThroughAssociation#ensure_not_nested
 *
 * @internal
 */
function ensureNotNested(assoc: HasOneThroughAssociation): void {
  const throughName = assoc.reflection.options.through as string | undefined;
  if (!throughName) return;
  const ctor = assoc.owner.constructor as { _reflectOnAssociation?: (n: string) => unknown };
  const throughRefl = ctor._reflectOnAssociation?.(throughName) as {
    options?: { through?: unknown };
  } | null;
  if (throughRefl?.options?.through) {
    throw new Error(`Nested through associations are read-only.`);
  }
}
