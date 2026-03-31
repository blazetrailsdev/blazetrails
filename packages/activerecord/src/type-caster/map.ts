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
    const klass = this._klass;

    // Class-level attribute type lookup (ActiveRecord::Base.attributeTypes)
    const attributeTypes = klass.attributeTypes ?? klass._attributeDefinitions;
    if (attributeTypes) {
      const type =
        attributeTypes instanceof globalThis.Map ? attributeTypes.get(name) : attributeTypes[name];
      if (type) return type as Type;
    }

    // Instance-level lookup fallback
    if (typeof klass.typeForAttribute === "function") {
      return klass.typeForAttribute(name) ?? new ValueType();
    }

    return new ValueType();
  }
}
