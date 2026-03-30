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
import { quoteIdentifier } from "../../connection-adapters/abstract/quoting.js";
import { JoinPart } from "./join-part.js";

export interface JoinReflection {
  name: string;
  type: "belongsTo" | "hasOne" | "hasMany" | "hasAndBelongsToMany";
  foreignKey: string;
  primaryKey?: string;
  modelClass: typeof Base;
  options?: Record<string, unknown>;
}

function qualifiedColumn(table: string, column: string): string {
  return `${quoteIdentifier(table)}.${quoteIdentifier(column)}`;
}

export class JoinAssociation extends JoinPart {
  readonly reflection: JoinReflection;
  private _table: string;
  readonly tables: string[] = [];
  private _readonly = false;
  private _strictLoading = false;

  constructor(reflection: JoinReflection, baseKlass: typeof Base, table: string) {
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
    if (!this.tables.includes(value)) {
      this.tables.push(value);
    }
  }

  isMatch(otherKlass: typeof Base): boolean {
    return this.reflection.modelClass === otherKlass;
  }

  joinConstraints(parentTable: string, parentKlass: typeof Base): string {
    const fk = this.reflection.foreignKey;
    const pk = this.reflection.primaryKey ?? (parentKlass.primaryKey as string) ?? "id";

    if (this.reflection.type === "belongsTo") {
      return `${qualifiedColumn(this._table, pk)} = ${qualifiedColumn(parentTable, fk)}`;
    }
    return `${qualifiedColumn(this._table, fk)} = ${qualifiedColumn(parentTable, pk)}`;
  }

  isReadonly(): boolean {
    return this._readonly;
  }

  isStrictLoading(): boolean {
    return this._strictLoading;
  }
}
