import type { Base } from "../base.js";
import type { AssociationReflection } from "../reflection.js";

/**
 * Base class for all association proxies. An Association wraps a single
 * association between an owner record and its target(s).
 *
 * Mirrors: ActiveRecord::Associations::Association
 */
export class Association {
  readonly owner: Base;
  readonly reflection: AssociationReflection;
  loaded: boolean;
  target: Base | Base[] | null;

  constructor(owner: Base, reflection: AssociationReflection) {
    this.owner = owner;
    this.reflection = reflection;
    this.loaded = false;
    this.target = null;
  }

  get klass(): typeof Base {
    return this.reflection.klass as typeof Base;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  isStale(): boolean {
    return false;
  }

  reset(): void {
    this.loaded = false;
    this.target = null;
  }

  reload(): this {
    this.reset();
    this.loaded = true;
    return this;
  }
}
