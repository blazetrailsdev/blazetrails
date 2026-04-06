import { AsyncLocalStorage } from "node:async_hooks";
import type { Base } from "./base.js";

import { Rollback, TransactionIsolationError } from "./errors.js";
export { Rollback };
import { Transaction } from "./connection-adapters/abstract/transaction.js";

type TransactionAction = "create" | "update" | "destroy";

// Per-async-context transaction tracking (safe under concurrent async operations)
const _transactionStorage = new AsyncLocalStorage<Transaction | null>();

// Per-adapter mutex: serializes beginTransaction so concurrent callers wait
// for the first BEGIN to complete before checking nesting state.
const _adapterLocks = new WeakMap<object, Promise<void>>();

async function acquireAdapterLock(adapter: object): Promise<() => void> {
  while (_adapterLocks.has(adapter)) {
    await _adapterLocks.get(adapter);
  }
  let release!: () => void;
  const lock = new Promise<void>((resolve) => {
    release = () => {
      _adapterLocks.delete(adapter);
      resolve();
    };
  });
  _adapterLocks.set(adapter, lock);
  return release;
}

/**
 * Get the currently active transaction, if any.
 */
export function currentTransaction(): Transaction | null {
  return _transactionStorage.getStore() ?? null;
}

/**
 * Execute a block within a database transaction.
 *
 * Mirrors: ActiveRecord::Base.transaction
 */
let _savepointCounter = 0;

export async function transaction<T>(
  modelClass: typeof Base,
  fn: (tx: Transaction) => Promise<T>,
  options?: { isolation?: string },
): Promise<T | undefined> {
  const adapter = modelClass.adapter;
  const previousTx = currentTransaction();

  if (options?.isolation) {
    if (previousTx !== null) {
      throw new TransactionIsolationError(
        "Setting transaction isolation level is not supported inside a nested transaction",
      );
    }
    throw new TransactionIsolationError(
      `Transaction isolation level '${options.isolation}' is not yet supported`,
    );
  }

  const tx = new Transaction(adapter);

  // Check nesting: either we're inside a transaction() call (AsyncLocalStorage)
  // or the adapter is already in a DB transaction (external code / test fixtures).
  const nested = previousTx !== null || adapter.inTransaction;
  const spName = nested ? `sp_${++_savepointCounter}` : null;

  // For outermost transactions, serialize on the adapter. This matches Rails
  // where each thread gets its own connection — concurrent callers queue.
  // Nested transactions (savepoints) skip the lock since they run inside
  // the outer transaction's locked scope.
  const releaseLock = nested ? null : await acquireAdapterLock(adapter);

  if (nested && spName) {
    await adapter.createSavepoint(spName);
  } else {
    await adapter.beginTransaction();
  }

  let result: T;
  try {
    result = await _transactionStorage.run(tx, () => fn(tx));
    if (nested && spName) {
      await adapter.releaseSavepoint(spName);
    } else {
      await adapter.commit();
    }
    await tx.commit();
  } catch (error) {
    if (nested && spName) {
      await adapter.rollbackToSavepoint(spName);
    } else {
      await adapter.rollback();
    }
    await tx.rollback();
    await tx.runAfterRollbackCallbacks();
    releaseLock?.();
    if (error instanceof Rollback) {
      return undefined;
    }
    throw error;
  }
  await tx.runAfterCommitCallbacks();
  releaseLock?.();
  return result;
}

/**
 * Execute a block within a savepoint (nested transaction).
 *
 * Mirrors: ActiveRecord::Base.transaction(requires_new: true)
 */
export async function savepoint<T>(
  modelClass: typeof Base,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const adapter = modelClass.adapter;

  await adapter.createSavepoint(name);

  try {
    const result = await fn();
    await adapter.releaseSavepoint(name);
    return result;
  } catch (error) {
    await adapter.rollbackToSavepoint(name);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ClassMethods — mirrors ActiveRecord::Transactions::ClassMethods
// These are standalone functions that take the model class as first arg,
// following the codebase mixin pattern.
// ---------------------------------------------------------------------------

type CallbackFn = (...args: any[]) => any;
type CallbackOptions = { on?: TransactionAction | TransactionAction[] };

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#before_commit
 * Registers directly on the model callback chain (ActiveModel does not
 * provide a `beforeCommit` class helper).
 */
export function beforeCommit(
  modelClass: typeof Base,
  fn: CallbackFn,
  options?: CallbackOptions,
): void {
  if (options?.on !== undefined) {
    const actions = Array.isArray(options.on) ? options.on : [options.on];
    for (const action of actions) {
      if (action !== "create" && action !== "update" && action !== "destroy") {
        throw new Error(`Unknown transaction action: ${action}`);
      }
    }
  }
  (modelClass as any)._ensureOwnCallbacks();
  (modelClass as any)._callbackChain.register("before", "commit", fn, options);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_commit
 */
export function afterCommit(
  modelClass: typeof Base,
  fn: CallbackFn,
  options?: CallbackOptions,
): void {
  (modelClass as any).afterCommit(fn, options);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_save_commit
 */
export function afterSaveCommit(modelClass: typeof Base, fn: CallbackFn): void {
  (modelClass as any).afterSaveCommit(fn);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_create_commit
 */
export function afterCreateCommit(modelClass: typeof Base, fn: CallbackFn): void {
  (modelClass as any).afterCreateCommit(fn);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_update_commit
 */
export function afterUpdateCommit(modelClass: typeof Base, fn: CallbackFn): void {
  (modelClass as any).afterUpdateCommit(fn);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_destroy_commit
 */
export function afterDestroyCommit(modelClass: typeof Base, fn: CallbackFn): void {
  (modelClass as any).afterDestroyCommit(fn);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#after_rollback
 */
export function afterRollback(
  modelClass: typeof Base,
  fn: CallbackFn,
  options?: CallbackOptions,
): void {
  (modelClass as any).afterRollback(fn, options);
}

/**
 * Mirrors: ActiveRecord::Transactions::ClassMethods#set_callback
 */
export function setCallback(
  modelClass: typeof Base,
  name: "commit" | "rollback" | "before_commit",
  fn: CallbackFn,
  options?: CallbackOptions,
): void {
  if (name === "commit") {
    afterCommit(modelClass, fn, options);
  } else if (name === "rollback") {
    afterRollback(modelClass, fn, options);
  } else if (name === "before_commit") {
    beforeCommit(modelClass, fn, options);
  }
}

// ---------------------------------------------------------------------------
// Instance methods — mirrors ActiveRecord::Transactions instance methods
// These are standalone functions that take the record as first arg.
// ---------------------------------------------------------------------------

/**
 * Wraps save in a transaction. If the save fails, rolls back.
 *
 * Mirrors: ActiveRecord::Transactions#save (override)
 */
export async function save(record: Base): Promise<boolean> {
  return withTransactionReturningStatus(record, async () => {
    return record.save();
  });
}

/**
 * Wraps save! in a transaction. If the save fails, rolls back.
 *
 * Mirrors: ActiveRecord::Transactions#save! (override)
 */
export async function saveBang(record: Base): Promise<boolean> {
  return withTransactionReturningStatus(record, async () => {
    return (record as any).saveBang();
  });
}

/**
 * Wraps destroy in a transaction.
 *
 * Mirrors: ActiveRecord::Transactions#destroy (override)
 */
export async function destroy(record: Base): Promise<Base | false> {
  return withTransactionReturningStatus(record, async () => {
    return record.destroy();
  });
}

/**
 * Wraps touch in a transaction.
 *
 * Mirrors: ActiveRecord::Transactions#touch (override)
 */
export async function touch(record: Base, ...columnNames: string[]): Promise<boolean> {
  return withTransactionReturningStatus(record, async () => {
    return (record as any).touch(...columnNames);
  });
}

/**
 * Run before_commit callbacks on the record.
 *
 * Mirrors: ActiveRecord::Transactions#before_committed!
 */
export async function beforeCommittedBang(record: Base): Promise<void> {
  const ctor = record.constructor as typeof Base;
  await (ctor as any)._callbackChain?.runBefore?.("commit", record);
}

/**
 * Run after_commit callbacks on the record.
 *
 * Mirrors: ActiveRecord::Transactions#committed!
 */
export async function committedBang(record: Base): Promise<void> {
  if (!isTriggerTransactionalCallbacks(record)) return;
  const ctor = record.constructor as typeof Base;
  await (ctor as any)._callbackChain?.runAfter?.("commit", record);
}

/**
 * Run after_rollback callbacks on the record.
 *
 * Mirrors: ActiveRecord::Transactions#rolledback!
 */
export async function rolledbackBang(record: Base): Promise<void> {
  if (!isTriggerTransactionalCallbacks(record)) return;
  const ctor = record.constructor as typeof Base;
  await (ctor as any)._callbackChain?.runAfter?.("rollback", record);
}

/**
 * Execute a block within a transaction and capture its return value as a
 * status flag. If the status is falsy, the transaction is rolled back.
 *
 * Mirrors: ActiveRecord::Transactions#with_transaction_returning_status
 */
export async function withTransactionReturningStatus<T>(
  record: Base,
  fn: () => Promise<T>,
): Promise<T> {
  const modelClass = record.constructor as typeof Base;
  let status: T;
  await transaction(modelClass, async () => {
    status = await fn();
    // Ruby truthiness: only false/nil trigger rollback (0, "" are truthy in Ruby)
    if (status === false || status == null) throw new Rollback();
    return status;
  });
  return status!;
}

/**
 * Returns whether the record should trigger transactional callbacks.
 *
 * Mirrors: ActiveRecord::Transactions#trigger_transactional_callbacks?
 */
export function isTriggerTransactionalCallbacks(record: Base): boolean {
  const r = record as any;
  const newBeforeLastCommit = r._newRecordBeforeLastCommit ?? false;
  const triggerUpdate = r._triggerUpdateCallback ?? false;
  const triggerDestroy = r._triggerDestroyCallback ?? false;
  return (
    ((newBeforeLastCommit || triggerUpdate) && record.isPersisted()) ||
    (triggerDestroy && record.isDestroyed())
  );
}
