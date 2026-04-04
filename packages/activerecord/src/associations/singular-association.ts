import type { Base } from "../base.js";
import type { AssociationDefinition } from "../associations.js";
import { Association } from "./association.js";

/**
 * Base class for has_one and belongs_to associations.
 *
 * Mirrors: ActiveRecord::Associations::SingularAssociation
 */
export class SingularAssociation extends Association {
  declare target: Base | null;
  private _futureTarget: Base | null = null;

  constructor(owner: Base, definition: AssociationDefinition) {
    super(owner, definition);
  }

  override reset(): void {
    super.reset();
    this.target = null;
    this._futureTarget = null;
  }

  writer(record: Base | null): void {
    this.replace(record);
  }

  build(attributes?: Record<string, unknown>): Base | null {
    const record = this.buildRecord(attributes);
    if (record) {
      this.setNewRecord(record);
    }
    return record;
  }

  forceReloadReader(): Base | null {
    this.reload();
    return this.target;
  }

  get reader(): Base | null {
    return this.target;
  }

  protected replace(record: Base | null): void {
    this.target = record;
    if (record !== null) {
      this.loadedBang();
    }
  }

  protected setNewRecord(record: Base): void {
    this.replace(record);
  }
}
