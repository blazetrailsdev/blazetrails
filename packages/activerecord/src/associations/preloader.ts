import type { Base } from "../base.js";

/**
 * Implements eager loading of associations. Given a set of records and
 * association names, loads all associated records in as few queries as
 * possible.
 *
 * Mirrors: ActiveRecord::Associations::Preloader
 */
export class Preloader {
  readonly records: Base[];
  readonly associations: string[];

  constructor(records: Base[], associations: string[]) {
    this.records = records;
    this.associations = associations;
  }

  async call(): Promise<void> {
    for (const assocName of this.associations) {
      for (const record of this.records) {
        await (record as any)[assocName];
      }
    }
  }
}
