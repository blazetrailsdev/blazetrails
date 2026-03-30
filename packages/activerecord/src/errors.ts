import { RecordInvalid } from "./validations.js";
export { RecordInvalid };

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

export class AssociationTypeMismatch extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AssociationTypeMismatch";
  }
}

export class SerializationTypeMismatch extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "SerializationTypeMismatch";
  }
}

export class AdapterNotSpecified extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AdapterNotSpecified";
  }
}

export class TableNotSpecified extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "TableNotSpecified";
  }
}

export class AdapterNotFound extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AdapterNotFound";
  }
}

export class AdapterError extends ActiveRecordError {
  readonly connectionPool?: unknown;

  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message);
    this.name = "AdapterError";
    this.connectionPool = options?.connectionPool;
  }
}

export class ConnectionNotEstablished extends AdapterError {
  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message, options);
    this.name = "ConnectionNotEstablished";
  }

  setPool(connectionPool: unknown): this {
    if (!(this as any)._poolSet) {
      (this as any).connectionPool = connectionPool;
      (this as any)._poolSet = true;
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

export class ConnectionNotDefined extends ConnectionNotEstablished {
  readonly connectionName?: string;
  readonly role?: string;
  readonly shard?: string;

  constructor(
    message?: string,
    options?: { connectionName?: string; role?: string; shard?: string },
  ) {
    super(message);
    this.name = "ConnectionNotDefined";
    this.connectionName = options?.connectionName;
    this.role = options?.role;
    this.shard = options?.shard;
  }
}

export class DatabaseConnectionError extends ConnectionNotEstablished {
  constructor(message?: string) {
    super(message ?? "Database connection error");
    this.name = "DatabaseConnectionError";
  }

  static hostnameError(hostname: string): DatabaseConnectionError {
    return new DatabaseConnectionError(
      `There is an issue connecting with your hostname: ${hostname}.\n\nPlease check your database configuration and ensure there is a valid connection to your database.`,
    );
  }

  static usernameError(username: string): DatabaseConnectionError {
    return new DatabaseConnectionError(
      `There is an issue connecting to your database with your username/password, username: ${username}.\n\nPlease check your database configuration to ensure the username/password are valid.`,
    );
  }
}

export class ExclusiveConnectionTimeoutError extends ConnectionTimeoutError {
  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message, options);
    this.name = "ExclusiveConnectionTimeoutError";
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

export class SoleRecordExceeded extends ActiveRecordError {
  readonly record?: any;

  constructor(record?: any) {
    super(`Wanted only one ${record?.name ?? "record"}`);
    this.name = "SoleRecordExceeded";
    this.record = record;
  }
}

export class StatementInvalid extends AdapterError {
  readonly sql?: string;
  readonly binds?: unknown[];

  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, { connectionPool: options?.connectionPool });
    this.name = "StatementInvalid";
    (this as any)._sql = options?.sql;
    (this as any)._binds = options?.binds;
  }

  get _sql(): string | undefined {
    return (this as any).__sql;
  }

  setQuery(sql: string, binds: unknown[]): this {
    if (!(this as any)._sqlSet) {
      (this as any)._sql = sql;
      (this as any)._binds = binds;
      (this as any)._sqlSet = true;
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

export class MismatchedForeignKey extends StatementInvalid {
  constructor(options?: {
    message?: string;
    sql?: string;
    binds?: unknown[];
    table?: string;
    foreignKey?: string;
    targetTable?: string;
    primaryKey?: string;
    primaryKeyColumn?: any;
    connectionPool?: unknown;
  }) {
    let msg: string;
    if (options?.table && options?.primaryKeyColumn) {
      const type = options.primaryKeyColumn.bigint?.() ? "bigint" : options.primaryKeyColumn.type;
      msg =
        `Column \`${options.foreignKey}\` on table \`${options.table}\` does not match column \`${options.primaryKey}\` on \`${options.targetTable}\`, ` +
        `which has type \`${options.primaryKeyColumn.sqlType}\`. ` +
        `To resolve this issue, change the type of the \`${options.foreignKey}\` column on \`${options.table}\` to be :${type}. ` +
        `(For example \`t.${type} :${options.foreignKey}\`).`;
    } else {
      msg =
        "There is a mismatch between the foreign key and primary key column types. " +
        "Verify that the foreign key column type and the primary key of the associated table match types.";
    }
    if (options?.message) {
      msg += `\nOriginal message: ${options.message}`;
    }
    super(msg, {
      sql: options?.sql,
      binds: options?.binds,
      connectionPool: options?.connectionPool,
    });
    this.name = "MismatchedForeignKey";
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

export class ValueTooLong extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "ValueTooLong";
  }
}

export class RangeError extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "RangeError";
  }
}

export class SQLWarning extends AdapterError {
  readonly code?: string;
  readonly level?: string;
  sql?: string;

  constructor(
    message?: string,
    code?: string,
    level?: string,
    sql?: string,
    connectionPool?: unknown,
  ) {
    super(message, { connectionPool });
    this.name = "SQLWarning";
    this.code = code;
    this.level = level;
    this.sql = sql;
  }
}

export class PreparedStatementInvalid extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "PreparedStatementInvalid";
  }
}

export class NoDatabaseError extends StatementInvalid {
  constructor(message?: string, options?: { connectionPool?: unknown }) {
    super(message ?? "Database not found", {
      connectionPool: options?.connectionPool,
    });
    this.name = "NoDatabaseError";
  }

  static dbError(dbName: string): NoDatabaseError {
    return new NoDatabaseError(
      `We could not find your database: ${dbName}. Available database configurations can be found in config/database.yml.`,
    );
  }
}

export class DatabaseAlreadyExists extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "DatabaseAlreadyExists";
  }
}

export class PreparedStatementCacheExpired extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "PreparedStatementCacheExpired";
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

export class AttributeAssignmentError extends ActiveRecordError {
  readonly exception?: Error;
  readonly attribute?: string;

  constructor(message?: string, exception?: Error, attribute?: string) {
    super(message);
    this.name = "AttributeAssignmentError";
    this.exception = exception;
    this.attribute = attribute;
  }
}

export class MultiparameterAssignmentErrors extends ActiveRecordError {
  readonly errors?: AttributeAssignmentError[];

  constructor(errors?: AttributeAssignmentError[]) {
    super("MultiparameterAssignmentErrors");
    this.name = "MultiparameterAssignmentErrors";
    this.errors = errors;
  }
}

export class UnknownPrimaryKey extends ActiveRecordError {
  readonly model?: any;

  constructor(model?: any, description?: string) {
    if (model) {
      let message = `Unknown primary key for table ${model.tableName} in model ${model}.`;
      if (description) message += `\n${description}`;
      super(message);
    } else {
      super("Unknown primary key.");
    }
    this.name = "UnknownPrimaryKey";
    this.model = model;
  }
}

export class UnmodifiableRelation extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "UnmodifiableRelation";
  }
}

export class TransactionIsolationError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "TransactionIsolationError";
  }
}

export class TransactionRollbackError extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "TransactionRollbackError";
  }
}

export class AsynchronousQueryInsideTransactionError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "AsynchronousQueryInsideTransactionError";
  }
}

export class SerializationFailure extends TransactionRollbackError {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "SerializationFailure";
  }
}

export class Deadlocked extends TransactionRollbackError {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "Deadlocked";
  }
}

export class IrreversibleOrderError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "IrreversibleOrderError";
  }
}

export class QueryAborted extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "QueryAborted";
  }
}

export class LockWaitTimeout extends StatementInvalid {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "LockWaitTimeout";
  }
}

export class StatementTimeout extends QueryAborted {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "StatementTimeout";
  }
}

export class QueryCanceled extends QueryAborted {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "QueryCanceled";
  }
}

export class AdapterTimeout extends QueryAborted {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "AdapterTimeout";
  }
}

export class ConnectionFailed extends QueryAborted {
  constructor(
    message?: string,
    options?: { sql?: string; binds?: unknown[]; connectionPool?: unknown },
  ) {
    super(message, options);
    this.name = "ConnectionFailed";
  }
}

export class UnknownAttributeReference extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "UnknownAttributeReference";
  }
}

export class DatabaseVersionError extends ActiveRecordError {
  constructor(message?: string) {
    super(message);
    this.name = "DatabaseVersionError";
  }
}

export class NameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NameError";
  }
}
