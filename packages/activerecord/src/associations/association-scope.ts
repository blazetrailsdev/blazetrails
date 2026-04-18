import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";
import type { Association } from "./association.js";

/**
 * Builds the scope (query) for an association based on its reflection.
 *
 * Mirrors: ActiveRecord::Associations::AssociationScope
 */
export class AssociationScope {
  static create(reflection: AssociationReflection): AssociationScope {
    return new AssociationScope(reflection);
  }

  /**
   * Build the base relation for an association — equivalent to
   * `association.klass.unscoped` plus join/where constraints derived from
   * the reflection chain. Delegates to the Association instance's own
   * `scope()` which already assembles the FK/type filtering.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope.scope
   */
  static scope(association: Association): unknown {
    return association.scope();
  }

  /**
   * Collect the FK/type bind values that drive the scope for a chain of
   * reflections. For the non-through case (chain length 1) the single
   * bind is the owner's FK value. For through chains, each step
   * contributes the type discriminator for polymorphic reflections.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope.get_bind_values
   */
  static getBindValues(owner: Base, chain: AssociationReflection[]): unknown[] {
    const binds: unknown[] = [];
    const last = chain[chain.length - 1];
    if (!last) return binds;

    const joinFk = (last as unknown as { joinForeignKey?: string | string[] }).joinForeignKey;
    const fks = Array.isArray(joinFk) ? joinFk : joinFk ? [joinFk] : [];
    for (const fk of fks) binds.push(owner.readAttribute(fk));

    if (last.type) {
      binds.push((owner.constructor as typeof Base).name);
    }

    for (let i = 0; i < chain.length - 1; i++) {
      const refl = chain[i];
      const next = chain[i + 1];
      if (refl.type) {
        binds.push((next as unknown as { klass?: { name: string } }).klass?.name ?? null);
      }
    }

    return binds;
  }

  readonly reflection: AssociationReflection;

  constructor(reflection: AssociationReflection) {
    this.reflection = reflection;
  }

  /**
   * Instance form — defers to the static builder for a given Association.
   *
   * Mirrors: ActiveRecord::Associations::AssociationScope#scope
   */
  scope(association: Association): unknown {
    return AssociationScope.scope(association);
  }
}

/**
 * Mirrors: ActiveRecord::Associations::AssociationScope::ReflectionProxy
 */
export class ReflectionProxy {
  readonly reflection: AssociationReflection;

  constructor(reflection: AssociationReflection) {
    this.reflection = reflection;
  }
}
