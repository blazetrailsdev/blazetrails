/**
 * PostgreSQL referential integrity — disable/enable FK constraints.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::ReferentialIntegrity
 */

import { quoteTableName } from "../abstract/quoting.js";

export interface ReferentialIntegrity {
  disableReferentialIntegrity(): Promise<void>;
  enableReferentialIntegrity(): Promise<void>;
}

export function disableReferentialIntegritySql(tables: string[]): string[] {
  return tables.map((t) => `ALTER TABLE ${quoteTableName(t, "postgres")} DISABLE TRIGGER ALL`);
}

export function enableReferentialIntegritySql(tables: string[]): string[] {
  return tables.map((t) => `ALTER TABLE ${quoteTableName(t, "postgres")} ENABLE TRIGGER ALL`);
}
