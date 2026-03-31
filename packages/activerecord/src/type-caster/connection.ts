import { Type, ValueType } from "@blazetrails/activemodel";

/**
 * Casts attribute values for database operations using the connection's
 * schema cache to look up column types.
 *
 * Mirrors: ActiveRecord::TypeCaster::Connection
 */
export class Connection {
  private _klass: any;
  private _tableName: string;

  constructor(klass: any, tableName: string) {
    this._klass = klass;
    this._tableName = tableName;
  }

  typeCastForDatabase(attrName: string, value: unknown): unknown {
    const type = this.typeForAttribute(attrName);
    return type.serialize(value);
  }

  typeForAttribute(attrName: string): Type {
    const column = this.resolveColumn(attrName);
    if (column) {
      const adapter = this._klass.adapter;
      if (adapter?.lookupCastTypeFromColumn) {
        return adapter.lookupCastTypeFromColumn(column);
      }
      if (adapter?.lookupCastType && (column as any).sqlType) {
        const castType = adapter.lookupCastType((column as any).sqlType);
        if (castType) return castType;
      }
    }
    return new ValueType();
  }

  private resolveColumn(attrName: string): unknown | undefined {
    // Try adapter.schemaCache (connection-level)
    const adapter = this._klass.adapter;
    const schemaCache = adapter?.schemaCache ?? adapter?.pool?.schemaCache;
    if (schemaCache) {
      const columns = schemaCache.columnsHash?.(this._tableName);
      return columns?.get?.(attrName) ?? columns?.[attrName];
    }

    // Try connection handler pool config
    const handler = this._klass._connectionHandler;
    if (handler) {
      const pool = handler.retrieveConnectionPool?.(this._klass);
      const poolCache = pool?.schemaCache;
      if (poolCache) {
        const columns = poolCache.columnsHash?.(this._tableName);
        return columns?.get?.(attrName) ?? columns?.[attrName];
      }
    }

    return undefined;
  }
}
