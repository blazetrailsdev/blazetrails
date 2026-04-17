import type { Base } from "../base.js";
import { Relation } from "../relation.js";
import type { CollectionProxy } from "./collection-proxy.js";
import { _setAssociationRelationCtor } from "./collection-proxy.js";

/**
 * A Relation produced by a collection association (e.g. `blog.posts`,
 * `blog.posts.where(...)`). Inherits from Relation so chain methods and
 * finders work unchanged, but routes writes (`build`, `create`, `create!`)
 * through the owning association so the foreign key, inverse, and loaded
 * target are wired up — matching `blog.posts.create(...)` in Rails.
 *
 * Mirrors: ActiveRecord::AssociationRelation
 */
export class AssociationRelation<T extends Base> extends Relation<T> {
  /** @internal The owning collection association. */
  _association: CollectionProxy<T>;

  constructor(modelClass: typeof Base, association: CollectionProxy<T>) {
    super(modelClass);
    this._association = association;
  }

  /**
   * Preserve the AssociationRelation subclass across `_clone()` so chains
   * like `blog.posts.where(...).order(...).create(...)` still route writes
   * through the association.
   */
  protected _newRelation(): Relation<T> {
    return new AssociationRelation<T>((this as any)._modelClass as typeof Base, this._association);
  }

  /**
   * Build an unsaved associated record. Merges the relation's scope
   * attributes (e.g. `where(title: "X")` → `{ title: "X" }`) with the
   * caller's attrs, then delegates to the association so the FK (and, for
   * polymorphic, the `*_type`) is set and the record is pushed onto the
   * loaded target.
   *
   * Mirrors: ActiveRecord::AssociationRelation#_new / #build
   */
  build(attrs: Record<string, unknown> = {}): T {
    const merged = { ...this._scopeAttributes(), ...attrs };
    return this._association.build(merged) as T;
  }

  /**
   * Build and persist an associated record through the owning association.
   *
   * Mirrors: ActiveRecord::AssociationRelation#_create / #create
   */
  async create(attrs: Record<string, unknown> = {}): Promise<T> {
    const merged = { ...this._scopeAttributes(), ...attrs };
    return this._association.create(merged) as Promise<T>;
  }

  /**
   * Build and persist an associated record, raising on validation failure.
   * CollectionProxy#create returns the unsaved record on failure rather
   * than throwing, so we surface that as RecordInvalid here to match
   * `create!`.
   *
   * Mirrors: ActiveRecord::AssociationRelation#_create! / #create!
   */
  async createBang(attrs: Record<string, unknown> = {}): Promise<T> {
    const merged = { ...this._scopeAttributes(), ...attrs };
    const record = (await this._association.create(merged)) as T;
    if ((record as Base).isNewRecord()) {
      const { RecordInvalid } = await import("../validations.js");
      throw new RecordInvalid(record as Base);
    }
    return record;
  }
}

_setAssociationRelationCtor(AssociationRelation);
