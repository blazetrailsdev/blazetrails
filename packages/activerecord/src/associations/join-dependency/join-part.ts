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
    const record: Record<string, unknown> = {};
    const prefix = `${columnAlias}_`;

    // Primary: keys in the form `${columnAlias}_<attr>`
    let matched = false;
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith(prefix)) {
        record[key.slice(prefix.length)] = value;
        matched = true;
      }
    }
    if (matched) return record;

    // Fallback: keys in the form `t{tableIndex}_r{columnIndex}` used by
    // the existing JoinDependency eager-load implementation
    const indexMatch = columnAlias.match(/^t(\d+)$/);
    if (indexMatch) {
      const pattern = new RegExp(`^t${indexMatch[1]}_r(\\d+)$`);
      const columns = this.baseKlass.columnNames();
      for (const [key, value] of Object.entries(row)) {
        const m = key.match(pattern);
        if (m) {
          const colIndex = Number(m[1]);
          const colName = columns[colIndex] ?? `r${m[1]}`;
          record[colName] = value;
        }
      }
    }

    return record;
  }

  instantiate(row: Record<string, unknown>, columnAlias: string): Base | null {
    const attrs = this.extractRecord(row, columnAlias);
    const hasData = Object.values(attrs).some((v) => v !== null && v !== undefined);
    if (!hasData) return null;
    return this.baseKlass._instantiate(attrs);
  }
}
