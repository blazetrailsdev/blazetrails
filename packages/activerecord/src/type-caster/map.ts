/**
 * Mirrors: ActiveRecord::TypeCaster::Map
 */
import { Type } from "@blazetrails/activemodel";

export class TypeCasterMap {
  private _klass: any;

  constructor(klass: any) {
    this._klass = klass;
  }

  typeCastForDatabase(attrName: string, value: unknown): unknown {
    const type = this.typeForAttribute(attrName);
    return type.serialize(value);
  }

  typeForAttribute(name: string): Type {
    return this._klass.typeForAttribute(name);
  }
}
