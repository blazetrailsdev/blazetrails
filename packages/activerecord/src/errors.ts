export class ActiveRecordError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "ActiveRecordError";
  }
}

export class SubclassNotFound extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "SubclassNotFound";
  }
}

export class AdapterNotSpecified extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AdapterNotSpecified";
  }
}

export class AdapterNotFound extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AdapterNotFound";
  }
}

export class AdapterError extends ActiveRecordError {
  protected _connectionPool?: unknown;

  get connectionPool(): unknown | undefined {
    return this._connectionPool;
  }

  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message);
    this.name = "AdapterError";
    this._connectionPool = options?.connectionPool;
  }
}

export class ConnectionNotEstablished extends AdapterError {
  private _poolSet = false;

  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message, options);
    this.name = "ConnectionNotEstablished";
  }

  setPool(connectionPool: unknown): this {
    if (!this._poolSet) {
      this._connectionPool = connectionPool;
      this._poolSet = true;
    }
    return this;
  }
}

export class ConnectionTimeoutError extends ConnectionNotEstablished {
  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message, options);
    this.name = "ConnectionTimeoutError";
  }
}

export class ReadOnlyError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "ReadOnlyError";
  }
}

export class RecordNotFound extends ActiveRecordError {
  readonly model: string;
  readonly primaryKey?: string;
  readonly id?: unknown;

  constructor(message?: string, model?: string, primaryKey?: string, id?: unknown) {
    super(message);
    this.name = "RecordNotFound";
    this.model = model ?? "Record";
    this.primaryKey = primaryKey;
    this.id = id;
  }
}

export class RecordNotSaved extends ActiveRecordError {
  readonly record: any;

  constructor(message?: string, record?: any) {
    super(message);
    this.name = "RecordNotSaved";
    this.record = record;
  }
}

export class RecordNotDestroyed extends ActiveRecordError {
  readonly record: any;

  constructor(message?: string, record?: any) {
    super(message);
    this.name = "RecordNotDestroyed";
    this.record = record;
  }
}

export class RecordInvalid extends ActiveRecordError {
  readonly record: any;

  constructor(record: any) {
    const fullMessages = record.errors?.fullMessages;
    const message =
      Array.isArray(fullMessages) && fullMessages.length > 0
        ? `Validation failed: ${fullMessages.join(", ")}`
        : "Validation failed";
    super(message);
    this.name = "RecordInvalid";
    this.record = record;
  }
}

export class SoleRecordExceeded extends ActiveRecordError {
  readonly record?: any;

  constructor(record?: any) {
    super(`Wanted only one ${record?.name ?? "record"}`);
    this.name = "SoleRecordExceeded";
    this.record = record;
  }
}

export class StatementInvalid extends AdapterError {
  sql?: string;
  binds?: unknown[];
  private _querySet = false;

  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, { connectionPool: options?.connectionPool });
    this.name = "StatementInvalid";
    this.sql = options?.sql;
    this.binds = options?.binds;
  }

  setQuery(sql: string, binds: unknown[]): this {
    if (!this._querySet) {
      this.sql = sql;
      this.binds = binds;
      this._querySet = true;
    }
    return this;
  }
}

export class WrappedDatabaseException extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "WrappedDatabaseException";
  }
}

export class RecordNotUnique extends WrappedDatabaseException {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "RecordNotUnique";
  }
}

export class InvalidForeignKey extends WrappedDatabaseException {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "InvalidForeignKey";
  }
}

export class NotNullViolation extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "NotNullViolation";
  }
}

export class StaleObjectError extends ActiveRecordError {
  readonly record?: any;
  readonly attemptedAction?: string;

  constructor(record?: any, attemptedAction?: string) {
    if (record && attemptedAction) {
      const model = record?.constructor?.name ?? "Record";
      super(`Attempted to ${attemptedAction} a stale object: ${model}.`);
    } else {
      super("Stale object error.");
    }
    this.name = "StaleObjectError";
    this.record = record;
    this.attemptedAction = attemptedAction;
  }
}

export class ConfigurationError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ReadOnlyRecord extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "ReadOnlyRecord";
  }
}

export class StrictLoadingViolationError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "StrictLoadingViolationError";
  }
}

export class Rollback extends ActiveRecordError {
  constructor() {
    super("Rollback");
    this.name = "Rollback";
  }
}

export class DangerousAttributeError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "DangerousAttributeError";
  }
}

export class UnknownAttributeError extends ActiveRecordError {
  readonly record: any;
  readonly attribute: string;

  constructor(record: any, attribute: string) {
    const model = record?.constructor?.name ?? "Record";
    super(`unknown attribute '${attribute}' for ${model}.`);
    this.name = "UnknownAttributeError";
    this.record = record;
    this.attribute = attribute;
  }
}

export class NameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NameError";
  }
}
