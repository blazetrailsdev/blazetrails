/**
 * JoinAssociation — a node in the join dependency tree representing
 * a joined association.
 *
 * Tracks the association reflection, table alias, and generates the
 * JOIN constraints for the SQL query.
 *
 * Mirrors: ActiveRecord::Associations::JoinDependency::JoinAssociation
 */

import type { Base } from "../../base.js";
import { JoinPart } from "./join-part.js";

export interface AssociationReflection {
  name: string;
  type: "belongsTo" | "hasOne" | "hasMany" | "hasAndBelongsToMany";
  foreignKey: string;
  primaryKey?: string;
  modelClass: typeof Base;
  options?: Record<string, unknown>;
}

export class JoinAssociation extends JoinPart {
  readonly reflection: AssociationReflection;
  private _table: string;
  readonly tables: string[] = [];
  private _readonly = false;
  private _strictLoading = false;

  constructor(reflection: AssociationReflection, baseKlass: typeof Base, table: string) {
    super(baseKlass);
    this.reflection = reflection;
    this._table = table;
    this.tables.push(table);
  }

  get table(): string {
    return this._table;
  }

  set table(value: string) {
    this._table = value;
  }

  isMatch(otherKlass: typeof Base): boolean {
    return this.reflection.modelClass === otherKlass;
  }

  joinConstraints(parentTable: string, parentKlass: typeof Base): string {
    const fk = this.reflection.foreignKey;
    const pk = this.reflection.primaryKey ?? "id";
    const type = this.reflection.type;

    if (type === "belongsTo") {
      return `"${this._table}"."${pk}" = "${parentTable}"."${fk}"`;
    }
    return `"${this._table}"."${fk}" = "${parentTable}"."${pk}"`;
  }

  isReadonly(): boolean {
    return this._readonly;
  }

  isStrictLoading(): boolean {
    return this._strictLoading;
  }
}
