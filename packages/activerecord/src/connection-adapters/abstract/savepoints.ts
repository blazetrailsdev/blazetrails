/**
 * Savepoints — savepoint SQL generation.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::Savepoints
 */

let _currentSavepointNumber = 0;

export function currentSavepointName(): string {
  return `active_record_${_currentSavepointNumber}`;
}

export function createSavepointSql(name: string): string {
  return `SAVEPOINT ${name}`;
}

export function execRollbackToSavepointSql(name: string): string {
  return `ROLLBACK TO SAVEPOINT ${name}`;
}

export function releaseSavepointSql(name: string): string {
  return `RELEASE SAVEPOINT ${name}`;
}

export function nextSavepointName(): string {
  _currentSavepointNumber++;
  return currentSavepointName();
}

export function resetSavepointNumber(): void {
  _currentSavepointNumber = 0;
}
