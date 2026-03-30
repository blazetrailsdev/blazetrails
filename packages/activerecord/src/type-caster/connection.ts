/**
 * Mirrors: ActiveRecord::TypeCaster::Connection
 */
import { Type, ValueType } from "@blazetrails/activemodel";

export class TypeCasterConnection {
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
    const schemaCache = this._klass.schemaCache;
    if (schemaCache?.dataSourceExists?.(this._tableName)) {
      const columnsHash = schemaCache.columnsHash(this._tableName);
      const column = columnsHash?.[attrName];
      if (column) {
        return column.type ?? new ValueType();
      }
    }
    return new ValueType();
  }
}
