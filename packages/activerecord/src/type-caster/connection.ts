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
    return type.serialize ? type.serialize(value) : value;
  }

  typeForAttribute(attrName: string): Type {
    const schemaCache = this._klass.schemaCache;
    if (schemaCache?.dataSourceExists?.(this._tableName)) {
      const columns = schemaCache.columnsHash?.(this._tableName);
      const column = columns?.[attrName];
      if (column) {
        const adapter = this._klass.adapter;
        if (adapter?.lookupCastTypeFromColumn) {
          return adapter.lookupCastTypeFromColumn(column);
        }
      }
    }
    return new ValueType();
  }
}
