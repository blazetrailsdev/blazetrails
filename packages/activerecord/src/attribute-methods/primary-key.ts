/**
 * Primary key attribute methods.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey
 */

interface PrimaryKeyRecord {
  id: unknown;
  readAttribute(name: string): unknown;
}

/**
 * Return an array of primary key values for this record, or null if unsaved.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey#to_key
 */
export function toKey(this: PrimaryKeyRecord): unknown[] | null {
  const pk = this.id;
  if (pk == null) return null;
  const arr = Array.isArray(pk) ? pk : [pk];
  if (arr.some((v) => v == null)) return null;
  return arr;
}

/**
 * Check whether all primary key values are present.
 *
 * Mirrors: ActiveRecord::AttributeMethods::PrimaryKey#primary_key_values_present?
 */
export function isPrimaryKeyValuesPresent(this: PrimaryKeyRecord): boolean {
  const pk = (this.constructor as any).primaryKey;
  if (Array.isArray(pk)) {
    return pk.every((col: string) => {
      const v = this.readAttribute(col);
      return v !== null && v !== undefined;
    });
  }
  return this.id != null;
}

export function idBeforeTypeCast(this: PrimaryKeyRecord): unknown {
  const pk = (this.constructor as any).primaryKey;
  if (typeof (this as any).readAttributeBeforeTypeCast === "function") {
    return (this as any).readAttributeBeforeTypeCast(pk);
  }
  return this.readAttribute(pk);
}

export function idWas(this: PrimaryKeyRecord): unknown {
  const pk = (this.constructor as any).primaryKey;
  if (typeof (this as any).attributeWas === "function") {
    return (this as any).attributeWas(pk);
  }
  return this.readAttribute(pk);
}

export function idInDatabase(this: PrimaryKeyRecord): unknown {
  const pk = (this.constructor as any).primaryKey;
  if (typeof (this as any).attributeInDatabase === "function") {
    return (this as any).attributeInDatabase(pk);
  }
  return this.readAttribute(pk);
}

export function idForDatabase(this: PrimaryKeyRecord): unknown {
  const pk = (this.constructor as any).primaryKey;
  const attrs = (this as any)._attributes;
  if (attrs?.getAttribute) {
    const attr = attrs.getAttribute(pk);
    if (attr?.valueForDatabase) return attr.valueForDatabase();
  }
  return this.readAttribute(pk);
}

// ---------------------------------------------------------------------------
// Class methods
// ---------------------------------------------------------------------------

interface PrimaryKeyHost {
  primaryKey: string | string[];
  _primaryKey?: string | string[];
  name: string;
}

export function isInstanceMethodAlreadyImplemented(
  this: PrimaryKeyHost & { prototype: any },
  methodName: string,
): boolean {
  return methodName in this.prototype;
}

export function isDangerousAttributeMethod(_this: PrimaryKeyHost, _name: string): boolean {
  return false;
}

export function quotedPrimaryKey(this: PrimaryKeyHost): string {
  const pk = this.primaryKey;
  if (Array.isArray(pk)) return pk.map((k) => `"${k}"`).join(", ");
  return `"${pk}"`;
}

export function resetPrimaryKey(this: PrimaryKeyHost): void {
  const parent = Object.getPrototypeOf(this);
  if (parent && typeof parent === "function" && parent.name !== "Base") {
    this._primaryKey = (parent as PrimaryKeyHost).primaryKey;
  } else {
    this._primaryKey = "id";
  }
}

export function getPrimaryKey(this: PrimaryKeyHost, _baseName?: string): string {
  return "id";
}
