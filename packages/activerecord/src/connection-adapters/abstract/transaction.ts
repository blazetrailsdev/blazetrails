import type { DatabaseAdapter } from "../../adapter.js";
import { ActiveRecordTransaction } from "../../transaction.js";
import { Notifications, NotificationEvent } from "@blazetrails/activesupport";

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::TransactionState
 */
export class TransactionState {
  private _state:
    | "committed"
    | "fully_committed"
    | "rolledback"
    | "fully_rolledback"
    | "invalidated"
    | null = null;
  private _children: TransactionState[] | null = null;

  constructor(state: TransactionState["_state"] = null) {
    this._state = state;
  }

  addChild(state: TransactionState): void {
    if (!this._children) this._children = [];
    this._children.push(state);
  }

  get finalized(): boolean {
    return this._state !== null;
  }

  get committed(): boolean {
    return this._state === "committed" || this._state === "fully_committed";
  }

  isCommitted(): boolean {
    return this.committed;
  }

  get fullyCommitted(): boolean {
    return this._state === "fully_committed";
  }

  isFullyCommitted(): boolean {
    return this.fullyCommitted;
  }

  isRolledback(): boolean {
    return this._state === "rolledback" || this._state === "fully_rolledback";
  }

  get rolledBack(): boolean {
    return this.isRolledback();
  }

  isFullyRolledback(): boolean {
    return this._state === "fully_rolledback";
  }

  get fullyRolledBack(): boolean {
    return this.isFullyRolledback();
  }

  isInvalidated(): boolean {
    return this._state === "invalidated";
  }

  isCompleted(): boolean {
    return this.committed || this.isRolledback();
  }

  get fullyCompleted(): boolean {
    return this.isCompleted();
  }

  rollbackBang(): void {
    this._children?.forEach((c) => c.rollbackBang());
    this._state = "rolledback";
  }

  fullRollbackBang(): void {
    this._children?.forEach((c) => c.rollbackBang());
    this._state = "fully_rolledback";
  }

  invalidateBang(): void {
    this._children?.forEach((c) => c.invalidateBang());
    this._state = "invalidated";
  }

  commitBang(): void {
    this._state = "committed";
  }

  fullCommitBang(): void {
    this._state = "fully_committed";
  }

  nullifyBang(): void {
    this._state = null;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::TransactionInstrumenter::InstrumentationNotStartedError
 */
export class InstrumentationNotStartedError extends Error {
  constructor(message = "Called finish on a transaction that hasn't started") {
    super(message);
    this.name = "InstrumentationNotStartedError";
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::TransactionInstrumenter::InstrumentationAlreadyStartedError
 */
export class InstrumentationAlreadyStartedError extends Error {
  constructor(message = "Called start on an already started transaction") {
    super(message);
    this.name = "InstrumentationAlreadyStartedError";
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::TransactionInstrumenter
 */
export class TransactionInstrumenter {
  static readonly InstrumentationNotStartedError = InstrumentationNotStartedError;
  static readonly InstrumentationAlreadyStartedError = InstrumentationAlreadyStartedError;

  private _started = false;
  private _basePayload: Record<string, unknown>;
  private _payload: Record<string, unknown> | null = null;
  private _event: NotificationEvent | null = null;

  constructor(payload: Record<string, unknown> = {}) {
    this._basePayload = payload;
  }

  start(): void {
    if (this._started) {
      throw new InstrumentationAlreadyStartedError();
    }
    this._started = true;

    Notifications.instrument("start_transaction.active_record", this._basePayload);

    this._payload = { ...this._basePayload };
    this._event = new NotificationEvent("transaction.active_record", new Date(), this._payload);
  }

  finish(outcome: string): void {
    if (!this._started) {
      throw new InstrumentationNotStartedError();
    }
    this._started = false;

    if (this._payload) {
      this._payload.outcome = outcome;
    }
    if (this._event) {
      this._event.finish();
      Notifications.publish("transaction.active_record", this._event.payload);
    }
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::NullTransaction
 */
export class NullTransaction {
  state: TransactionState | undefined = undefined;

  get open(): boolean {
    return false;
  }

  get closed(): boolean {
    return true;
  }

  get joinable(): boolean {
    return false;
  }

  isRestartable(): boolean {
    return false;
  }

  isDirty(): boolean {
    return false;
  }

  dirtyBang(): void {}

  isInvalidated(): boolean {
    return false;
  }

  invalidateBang(): void {}

  isMaterialized(): boolean {
    return false;
  }

  addRecord(_record: unknown, _ensureFinalize = true): void {}

  beforeCommit(fn?: () => void | Promise<void>): void | Promise<void> {
    if (fn) return fn();
  }

  afterCommit(fn?: () => void | Promise<void>): void | Promise<void> {
    if (fn) return fn();
  }

  afterRollback(_fn?: () => void | Promise<void>): void {}

  get userTransaction(): ActiveRecordTransaction {
    return ActiveRecordTransaction.NULL_TRANSACTION;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::Transaction::Callback
 */
export class TransactionCallback {
  private _event: "before_commit" | "after_commit" | "after_rollback";
  private _callback: () => void | Promise<void>;

  constructor(
    event: "before_commit" | "after_commit" | "after_rollback",
    callback: () => void | Promise<void>,
  ) {
    this._event = event;
    this._callback = callback;
  }

  beforeCommit(): void | Promise<void> {
    if (this._event === "before_commit") return this._callback();
  }

  afterCommit(): void | Promise<void> {
    if (this._event === "after_commit") return this._callback();
  }

  afterRollback(): void | Promise<void> {
    if (this._event === "after_rollback") return this._callback();
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::Transaction
 */
export class Transaction {
  readonly state = new TransactionState();
  private _callbacks: TransactionCallback[] | null = null;
  private _records: unknown[] | null = null;
  private _lazyEnrollmentRecords: WeakMap<object, unknown> | null = null;
  private _connection: DatabaseAdapter;
  private _joinable: boolean;
  readonly isolationLevel: string | null;
  private _materialized = false;
  private _runCommitCallbacks: boolean;
  private _dirty = false;
  written = false;
  readonly userTransaction: ActiveRecordTransaction;
  protected _instrumenter: TransactionInstrumenter;

  static readonly Callback = TransactionCallback;

  constructor(
    connection: DatabaseAdapter,
    options: {
      isolation?: string | null;
      joinable?: boolean;
      runCommitCallbacks?: boolean;
    } = {},
  ) {
    this._connection = connection;
    this._joinable = options.joinable ?? true;
    this.isolationLevel = options.isolation ?? null;
    this._runCommitCallbacks = options.runCommitCallbacks ?? false;
    this.userTransaction = this._joinable
      ? new ActiveRecordTransaction(this)
      : ActiveRecordTransaction.NULL_TRANSACTION;
    this._instrumenter = new TransactionInstrumenter({
      connection,
      transaction: this.userTransaction,
    });
  }

  get connection(): DatabaseAdapter {
    return this._connection;
  }

  get open(): boolean {
    return true;
  }

  get closed(): boolean {
    return false;
  }

  get joinable(): boolean {
    return this._joinable;
  }

  invalidateBang(): void {
    this.state.invalidateBang();
  }

  isInvalidated(): boolean {
    return this.state.isInvalidated();
  }

  dirtyBang(): void {
    this._dirty = true;
  }

  isDirty(): boolean {
    return this._dirty;
  }

  isRestartable(): boolean {
    return this.joinable && !this.isDirty();
  }

  isMaterialized(): boolean {
    return this._materialized;
  }

  materializeBang(): void {
    this._materialized = true;
    this._instrumenter.start();
  }

  incompleteBang(): void {
    if (this.isMaterialized()) {
      this._instrumenter.finish("incomplete");
    }
  }

  restoreBang(): void {
    if (this.isMaterialized()) {
      this.incompleteBang();
      this._materialized = false;
      this.materializeBang();
    }
  }

  addRecord(record: unknown, ensureFinalize = true): void {
    if (!this._records) this._records = [];
    if (ensureFinalize) {
      this._records.push(record);
    } else {
      if (!this._lazyEnrollmentRecords) this._lazyEnrollmentRecords = new WeakMap();
      this._lazyEnrollmentRecords.set(record as object, record);
    }
  }

  get records(): unknown[] | null {
    if (this._lazyEnrollmentRecords && this._records) {
      // WeakMap doesn't have .values() — lazy records are best-effort
      this._lazyEnrollmentRecords = null;
    }
    return this._records;
  }

  beforeCommit(fn: () => void | Promise<void>): void {
    if (this.state.finalized) {
      throw new Error("Cannot register callbacks on a finalized transaction");
    }
    if (!this._callbacks) this._callbacks = [];
    this._callbacks.push(new TransactionCallback("before_commit", fn));
  }

  afterCommit(fn: () => void | Promise<void>): void {
    if (this.state.finalized) {
      throw new Error("Cannot register callbacks on a finalized transaction");
    }
    if (!this._callbacks) this._callbacks = [];
    this._callbacks.push(new TransactionCallback("after_commit", fn));
  }

  afterRollback(fn: () => void | Promise<void>): void {
    if (this.state.finalized) {
      throw new Error("Cannot register callbacks on a finalized transaction");
    }
    if (!this._callbacks) this._callbacks = [];
    this._callbacks.push(new TransactionCallback("after_rollback", fn));
  }

  async rollbackRecords(): Promise<void> {
    if (this._records) {
      const ite = this._uniqueRecords();
      for (const record of ite) {
        if (typeof (record as any).rolledbackBang === "function") {
          await (record as any).rolledbackBang({
            forceRestoreState: this.isFullRollback(),
            shouldRunCallbacks: true,
          });
        }
      }
    }
    if (this._callbacks) {
      for (const cb of this._callbacks) {
        await cb.afterRollback();
      }
    }
  }

  async beforeCommitRecords(): Promise<void> {
    if (this._runCommitCallbacks) {
      if (this._records) {
        const ite = this._uniqueRecords();
        for (const record of ite) {
          if (typeof (record as any).beforeCommittedBang === "function") {
            await (record as any).beforeCommittedBang();
          }
        }
      }
      if (this._callbacks) {
        for (const cb of this._callbacks) {
          await cb.beforeCommit();
        }
      }
    }
  }

  async commitRecords(): Promise<void> {
    if (this._records) {
      const ite = this._uniqueRecords();
      if (this._runCommitCallbacks) {
        for (const record of ite) {
          if (typeof (record as any).committedBang === "function") {
            await (record as any).committedBang({ shouldRunCallbacks: true });
          }
        }
      } else {
        for (const record of ite) {
          if (typeof (this._connection as any).addTransactionRecord === "function") {
            (this._connection as any).addTransactionRecord(record);
          }
        }
      }
    }

    if (this._runCommitCallbacks) {
      if (this._callbacks) {
        for (const cb of this._callbacks) {
          await cb.afterCommit();
        }
      }
    } else if (this._callbacks) {
      const current = (this._connection as any).currentTransaction?.();
      if (current && typeof current.appendCallbacks === "function") {
        current.appendCallbacks(this._callbacks);
      }
    }
  }

  restart(): void {
    // Subclasses override
  }

  isFullRollback(): boolean {
    return true;
  }

  appendCallbacks(callbacks: TransactionCallback[]): void {
    if (!this._callbacks) this._callbacks = [];
    this._callbacks.push(...callbacks);
  }

  async commit(): Promise<void> {
    this.state.commitBang();
  }

  async rollback(): Promise<void> {
    this.state.rollbackBang();
  }

  async runAfterCommitCallbacks(): Promise<void> {
    if (!this._callbacks) return;
    for (const cb of this._callbacks) {
      await cb.afterCommit();
    }
  }

  async runAfterRollbackCallbacks(): Promise<void> {
    if (!this._callbacks) return;
    for (const cb of this._callbacks) {
      await cb.afterRollback();
    }
  }

  private _uniqueRecords(): unknown[] {
    if (!this._records) return [];
    const seen = new Set<unknown>();
    const result: unknown[] = [];
    for (const record of this._records) {
      if (!seen.has(record)) {
        seen.add(record);
        result.push(record);
      }
    }
    return result;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::RestartParentTransaction
 */
export class RestartParentTransaction extends Transaction {
  private _parent: Transaction;

  constructor(
    connection: DatabaseAdapter,
    parentTransaction: Transaction,
    options: { isolation?: string | null; joinable?: boolean; runCommitCallbacks?: boolean } = {},
  ) {
    super(connection, options);

    this._parent = parentTransaction;

    if (this.isolationLevel) {
      throw new Error("cannot set transaction isolation in a nested transaction");
    }

    parentTransaction.state.addChild(this.state);
  }

  override materializeBang(): void {
    this._parent.materializeBang();
  }

  override isMaterialized(): boolean {
    return this._parent.isMaterialized();
  }

  restart(): void {
    this._parent.restart();
  }

  override async rollback(): Promise<void> {
    this.state.rollbackBang();
    this._parent.restart();
  }

  override async commit(): Promise<void> {
    this.state.commitBang();
  }

  override isFullRollback(): boolean {
    return false;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::SavepointTransaction
 */
export class SavepointTransaction extends Transaction {
  readonly savepointName: string;

  constructor(
    connection: DatabaseAdapter,
    savepointName: string,
    parentTransaction: Transaction,
    options: { isolation?: string | null; joinable?: boolean; runCommitCallbacks?: boolean } = {},
  ) {
    super(connection, options);

    parentTransaction.state.addChild(this.state);

    if (this.isolationLevel) {
      throw new Error("cannot set transaction isolation in a nested transaction");
    }

    this.savepointName = savepointName;
  }

  override materializeBang(): void {
    this.connection.createSavepoint(this.savepointName);
    super.materializeBang();
  }

  restart(): void {
    if (!this.isMaterialized()) return;
    this._instrumenter.finish("restart");
    this._instrumenter.start();
    this.connection.rollbackToSavepoint(this.savepointName);
  }

  override async rollback(): Promise<void> {
    if (!this.state.isInvalidated()) {
      if (this.isMaterialized()) {
        await this.connection.rollbackToSavepoint(this.savepointName);
      }
    }
    this.state.rollbackBang();
    if (this.isMaterialized()) {
      this._instrumenter.finish("rollback");
    }
  }

  override async commit(): Promise<void> {
    if (this.isMaterialized()) {
      await this.connection.releaseSavepoint(this.savepointName);
    }
    this.state.commitBang();
    if (this.isMaterialized()) {
      this._instrumenter.finish("commit");
    }
  }

  override isFullRollback(): boolean {
    return false;
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::RealTransaction
 */
export class RealTransaction extends Transaction {
  override materializeBang(): void {
    if (this.joinable) {
      if (this.isolationLevel) {
        (this.connection as any).beginIsolatedDbTransaction(this.isolationLevel);
      } else {
        (this.connection as any).beginDbTransaction();
      }
    } else {
      (this.connection as any).beginDeferredTransaction(this.isolationLevel);
    }
    super.materializeBang();
  }

  restart(): void {
    if (!this.isMaterialized()) return;
    this._instrumenter.finish("restart");

    if (
      typeof (this.connection as any).supportsRestartDbTransaction === "function" &&
      (this.connection as any).supportsRestartDbTransaction()
    ) {
      this._instrumenter.start();
      (this.connection as any).restartDbTransaction();
    } else {
      (this.connection as any).rollbackDbTransaction();
      this.materializeBang();
    }
  }

  override async rollback(): Promise<void> {
    if (this.isMaterialized()) {
      (this.connection as any).rollbackDbTransaction();
      if (
        this.isolationLevel &&
        typeof (this.connection as any).resetIsolationLevel === "function"
      ) {
        (this.connection as any).resetIsolationLevel();
      }
    }
    this.state.fullRollbackBang();
    if (this.isMaterialized()) {
      this._instrumenter.finish("rollback");
    }
  }

  override async commit(): Promise<void> {
    if (this.isMaterialized()) {
      (this.connection as any).commitDbTransaction();
      if (
        this.isolationLevel &&
        typeof (this.connection as any).resetIsolationLevel === "function"
      ) {
        (this.connection as any).resetIsolationLevel();
      }
    }
    this.state.fullCommitBang();
    if (this.isMaterialized()) {
      this._instrumenter.finish("commit");
    }
  }
}

/**
 * Mirrors: ActiveRecord::ConnectionAdapters::TransactionManager
 */
export class TransactionManager {
  private _stack: (Transaction | NullTransaction)[] = [];
  private _connection: DatabaseAdapter;
  private _hasUnmaterializedTransactions = false;
  private _materializingTransactions = false;
  private _lazyTransactionsEnabled = true;

  static readonly NULL_TRANSACTION = Object.freeze(new NullTransaction());

  constructor(connection: DatabaseAdapter) {
    this._connection = connection;
  }

  get currentTransaction(): Transaction | NullTransaction {
    return this._stack.length > 0
      ? this._stack[this._stack.length - 1]
      : TransactionManager.NULL_TRANSACTION;
  }

  get openTransactions(): number {
    return this._stack.length;
  }

  get withinNewTransaction(): boolean {
    return this._stack.length > 0;
  }

  async beginTransaction(
    options: { isolation?: string | null; joinable?: boolean; _lazy?: boolean } = {},
  ): Promise<Transaction> {
    const { isolation = null, joinable = true, _lazy = true } = options;
    const current = this.currentTransaction;
    const runCommitCallbacks = current instanceof Transaction ? !current.joinable : true;

    let transaction: Transaction;

    if (this._stack.length === 0) {
      transaction = new RealTransaction(this._connection, {
        isolation,
        joinable,
        runCommitCallbacks,
      });
    } else if (current instanceof Transaction && current.isRestartable()) {
      transaction = new RestartParentTransaction(this._connection, current, {
        isolation,
        joinable,
        runCommitCallbacks,
      });
    } else {
      const parentTransaction = current instanceof Transaction ? current : undefined;
      transaction = new SavepointTransaction(
        this._connection,
        `active_record_${this._stack.length}`,
        parentTransaction!,
        { isolation, joinable, runCommitCallbacks },
      );
    }

    if (!transaction.isMaterialized()) {
      if (
        typeof (this._connection as any).supportsLazyTransactions === "function" &&
        (this._connection as any).supportsLazyTransactions() &&
        this.isLazyTransactionsEnabled() &&
        _lazy
      ) {
        this._hasUnmaterializedTransactions = true;
      } else {
        transaction.materializeBang();
      }
    }

    this._stack.push(transaction);
    return transaction;
  }

  disableLazyTransactionsBang(): void {
    this.materializeTransactions();
    this._lazyTransactionsEnabled = false;
  }

  enableLazyTransactionsBang(): void {
    this._lazyTransactionsEnabled = true;
  }

  isLazyTransactionsEnabled(): boolean {
    return this._lazyTransactionsEnabled;
  }

  dirtyCurrentTransaction(): void {
    const current = this.currentTransaction;
    if (current instanceof Transaction) {
      current.dirtyBang();
    }
  }

  restoreTransactions(): boolean {
    if (!this.isRestorable()) return false;
    for (const t of this._stack) {
      if (t instanceof Transaction) {
        t.restoreBang();
      }
    }
    return true;
  }

  isRestorable(): boolean {
    return this._stack.every((t) => {
      if (t instanceof Transaction) return !t.isDirty();
      return true;
    });
  }

  materializeTransactions(): void {
    if (this._materializingTransactions) return;

    if (this._hasUnmaterializedTransactions) {
      try {
        this._materializingTransactions = true;
        for (const t of this._stack) {
          if (t instanceof Transaction && !t.isMaterialized()) {
            t.materializeBang();
          }
        }
      } finally {
        this._materializingTransactions = false;
      }
      this._hasUnmaterializedTransactions = false;
    }
  }

  async commitTransaction(): Promise<void> {
    const transaction = this._stack[this._stack.length - 1];
    if (!(transaction instanceof Transaction)) return;

    try {
      await transaction.beforeCommitRecords();
    } finally {
      this._stack.pop();
    }

    if (transaction.isDirty()) {
      this.dirtyCurrentTransaction();
    }

    await transaction.commit();
    await transaction.commitRecords();
  }

  async rollbackTransaction(transaction?: Transaction): Promise<void> {
    const txn = transaction || this._stack[this._stack.length - 1];
    if (!(txn instanceof Transaction)) return;

    try {
      await txn.rollback();
    } finally {
      if (this._stack[this._stack.length - 1] === txn) {
        this._stack.pop();
      }
    }
    await txn.rollbackRecords();
  }
}
