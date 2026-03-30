/**
 * PostgreSQL referential integrity — disable/enable FK constraints.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::ReferentialIntegrity
 */

export interface ReferentialIntegrity {
  disableReferentialIntegrity(): Promise<void>;
  enableReferentialIntegrity(): Promise<void>;
}

export function disableReferentialIntegritySql(tables: string[]): string[] {
  return tables.map((t) => `ALTER TABLE ${t} DISABLE TRIGGER ALL`);
}

export function enableReferentialIntegritySql(tables: string[]): string[] {
  return tables.map((t) => `ALTER TABLE ${t} ENABLE TRIGGER ALL`);
}
