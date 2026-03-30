/**
 * JoinPart — base class for nodes in the join dependency tree.
 *
 * Each JoinPart represents a table that participates in a JOIN query,
 * tracking its model class, table alias, and child associations.
 *
 * Mirrors: ActiveRecord::Associations::JoinDependency::JoinPart
 */

import type { Base } from "../../base.js";

export abstract class JoinPart {
  readonly baseKlass: typeof Base;
  readonly children: JoinPart[] = [];

  constructor(baseKlass: typeof Base) {
    this.baseKlass = baseKlass;
  }

  abstract get table(): string;

  isMatch(otherKlass: typeof Base): boolean {
    return this.baseKlass === otherKlass;
  }

  each(fn: (part: JoinPart) => void): void {
    fn(this);
    for (const child of this.children) {
      child.each(fn);
    }
  }

  eachChildren(fn: (part: JoinPart) => void): void {
    for (const child of this.children) {
      fn(child);
      child.eachChildren(fn);
    }
  }

  extractRecord(row: Record<string, unknown>, columnAlias: string): Record<string, unknown> {
    const prefix = `${columnAlias}_`;
    const record: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith(prefix)) {
        record[key.slice(prefix.length)] = value;
      }
    }
    return record;
  }

  instantiate(row: Record<string, unknown>, columnAlias: string): Base {
    const attrs = this.extractRecord(row, columnAlias);
    return this.baseKlass._instantiate(attrs);
  }
}
