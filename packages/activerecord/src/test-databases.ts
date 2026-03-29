/**
 * Test databases — utilities for managing test database lifecycle.
 *
 * Mirrors: ActiveRecord::TestDatabases
 */

export function createAndMigrate(count: number): Promise<void> {
  throw new Error("TestDatabases.createAndMigrate is not yet implemented");
}

export function eachDatabase(
  callback: (name: string, index: number) => void | Promise<void>,
): Promise<void> {
  throw new Error("TestDatabases.eachDatabase is not yet implemented");
}
