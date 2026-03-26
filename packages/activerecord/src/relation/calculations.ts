/**
 * Calculation methods mixed into Relation: count, sum, average,
 * minimum, maximum, pluck, pick, ids.
 *
 * Mirrors: ActiveRecord::Calculations
 */
export class Calculations {}

/**
 * Tracks column aliases during calculation queries to avoid
 * conflicts when multiple aggregates are computed.
 *
 * Mirrors: ActiveRecord::Calculations::ColumnAliasTracker
 */
export class ColumnAliasTracker {
  private _aliases: Map<string, number> = new Map();

  aliasFor(column: string): string {
    const count = this._aliases.get(column) ?? 0;
    this._aliases.set(column, count + 1);
    if (count === 0) return column;
    return `${column}_${count}`;
  }
}
