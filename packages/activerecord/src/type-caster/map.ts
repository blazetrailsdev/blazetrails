import { Type, ValueType } from "@blazetrails/activemodel";

/**
 * Casts attribute values for database operations using the model's
 * attribute type registry (attribute API).
 *
 * Mirrors: ActiveRecord::TypeCaster::Map
 */
export class Map {
  private _klass: any;

  constructor(klass: any) {
    this._klass = klass;
  }

  typeCastForDatabase(attrName: string, value: unknown): unknown {
    const type = this.typeForAttribute(attrName);
    return type.serialize(value);
  }

  typeForAttribute(name: string): Type {
    if (this._klass.typeForAttribute) {
      return this._klass.typeForAttribute(name) ?? new ValueType();
    }
    return new ValueType();
  }
}
