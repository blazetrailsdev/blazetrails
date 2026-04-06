import { Transaction as InternalTransaction } from "./connection-adapters/abstract/transaction.js";

function generateUuidV4(): string {
  // Simple v4-like UUID generation without crypto dependency
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = (n: number) => Array.from({ length: n }, hex).join("");
  return `${s(8)}-${s(4)}-4${s(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${s(3)}-${s(12)}`;
}

/**
 * Represents the current transaction state for application-level interaction.
 *
 * It can either map to an actual transaction/savepoint, or represent the
 * absence of a transaction.
 *
 * Mirrors: ActiveRecord::Transaction
 */
export class ActiveRecordTransaction {
  private _internalTransaction: InternalTransaction | null;
  private _uuid: string | null = null;

  constructor(internalTransaction: InternalTransaction | null) {
    this._internalTransaction = internalTransaction;
  }

  /**
   * Registers a block to be called after the transaction is fully committed.
   * If there is no currently open transaction, the block is called immediately.
   *
   * Mirrors: ActiveRecord::Transaction#after_commit
   */
  afterCommit(fn: () => void | Promise<void>): void {
    if (this._internalTransaction == null) {
      fn();
    } else {
      this._internalTransaction.afterCommit(fn);
    }
  }

  /**
   * Registers a block to be called after the transaction is rolled back.
   * If there is no currently open transaction, the block is not called.
   *
   * Mirrors: ActiveRecord::Transaction#after_rollback
   */
  afterRollback(fn: () => void | Promise<void>): void {
    this._internalTransaction?.afterRollback(fn);
  }

  /**
   * Returns true if the transaction exists and isn't finalized yet.
   *
   * Mirrors: ActiveRecord::Transaction#open?
   */
  isOpen(): boolean {
    return !this.isClosed();
  }

  /**
   * Returns true if the transaction doesn't exist or is finalized.
   *
   * Mirrors: ActiveRecord::Transaction#closed?
   */
  isClosed(): boolean {
    return this._internalTransaction == null || this._internalTransaction.state.finalized;
  }

  /**
   * Returns true if the transaction doesn't exist or is finalized.
   * Alias for isClosed.
   *
   * Mirrors: ActiveRecord::Transaction#blank?
   */
  isBlank(): boolean {
    return this.isClosed();
  }

  /**
   * Returns a UUID for this transaction or null if no transaction is open.
   *
   * Mirrors: ActiveRecord::Transaction#uuid
   */
  uuid(): string | null {
    if (this._internalTransaction) {
      if (!this._uuid) {
        this._uuid = generateUuidV4();
      }
      return this._uuid;
    }
    return null;
  }

  static readonly NULL_TRANSACTION = new ActiveRecordTransaction(null);
}
