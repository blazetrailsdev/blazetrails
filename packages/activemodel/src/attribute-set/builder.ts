import { Attribute } from "../attribute.js";
import { Type, ValueType } from "../type/value.js";

/**
 * A set of Attribute instances keyed by name.
 *
 * Mirrors: ActiveModel::AttributeSet
 */
export class AttributeSet {
  private attributes: Map<string, Attribute>;

  constructor(attributes: Map<string, Attribute> = new Map()) {
    this.attributes = attributes;
  }

  /**
   * Get the Attribute instance for a name.
   */
  getAttribute(name: string): Attribute {
    return this.attributes.get(name) ?? Attribute.null(name);
  }

  /**
   * Get the cast value of an attribute (backward-compatible with Map.get).
   */
  get(name: string): unknown {
    const attr = this.attributes.get(name);
    if (!attr) return undefined;
    return attr.value;
  }

  set(name: string, attrOrValue: Attribute | unknown): void {
    if (attrOrValue instanceof Attribute) {
      this.attributes.set(name, attrOrValue);
    } else {
      const existing = this.attributes.get(name);
      const type = existing ? existing.type : new ValueType();
      this.attributes.set(name, Attribute.withCastValue(name, attrOrValue, type));
    }
  }

  has(name: string): boolean {
    const attr = this.attributes.get(name);
    return attr !== undefined && attr.isInitialized();
  }

  keys(): string[] {
    const result: string[] = [];
    for (const [name, attr] of this.attributes) {
      if (attr.isInitialized()) result.push(name);
    }
    return result;
  }

  fetchValue(name: string): unknown {
    return this.getAttribute(name).value;
  }

  writeFromUser(name: string, value: unknown): unknown {
    const existing = this.attributes.get(name);
    if (existing) {
      this.attributes.set(name, existing.withValueFromUser(value));
    } else {
      // New attribute not previously declared — create a FromUser with ValueType
      this.attributes.set(name, Attribute.fromUser(name, value, new ValueType()));
    }
    return value;
  }

  writeFromDatabase(name: string, value: unknown): void {
    const attr = this.getAttribute(name);
    this.attributes.set(name, attr.withValueFromDatabase(value));
  }

  writeCastValue(name: string, value: unknown): void {
    const attr = this.attributes.get(name);
    if (attr) {
      attr.overrideCastValue(value);
    } else {
      this.attributes.set(name, Attribute.withCastValue(name, value, new ValueType()));
    }
  }

  toHash(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const name of this.keys()) {
      result[name] = this.fetchValue(name);
    }
    return result;
  }

  valuesBeforeTypeCast(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, attr] of this.attributes) {
      if (attr.isInitialized()) {
        result[name] = attr.valueBeforeTypeCast;
      }
    }
    return result;
  }

  /**
   * Capture current cast values for all initialized attributes.
   */
  snapshotValues(): Map<string, unknown> {
    const result = new Map<string, unknown>();
    for (const [name, attr] of this.attributes) {
      if (attr.isInitialized()) {
        result.set(name, attr.value);
      }
    }
    return result;
  }

  valuesForDatabase(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, attr] of this.attributes) {
      if (attr.isInitialized()) {
        result[name] = attr.valueForDatabase;
      }
    }
    return result;
  }

  delete(name: string): boolean {
    return this.attributes.delete(name);
  }

  reset(name: string): void {
    if (this.has(name)) {
      this.writeFromDatabase(name, null);
    }
  }

  deepDup(): AttributeSet {
    const newAttrs = new Map<string, Attribute>();
    const originalToClone = new Map<Attribute, Attribute>();

    // First pass: clone each Attribute
    for (const [name, attr] of this.attributes) {
      const cloned = Object.assign(Object.create(Object.getPrototypeOf(attr)), attr);
      newAttrs.set(name, cloned);
      originalToClone.set(attr, cloned);
    }

    // Second pass: remap originalAttribute chains to cloned instances
    for (const [, cloned] of newAttrs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orig = (cloned as any).originalAttribute as Attribute | null;
      if (orig) {
        const mapped = originalToClone.get(orig);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (mapped) (cloned as any).originalAttribute = mapped;
      }
    }

    return new AttributeSet(newAttrs);
  }

  forEach(fn: (attr: Attribute, name: string) => void): void {
    for (const [name, attr] of this.attributes) {
      fn(attr, name);
    }
  }

  /**
   * Make AttributeSet iterable — yields [name, value] pairs for compatibility
   * with code that iterates `for (const [k, v] of _attributes)`.
   */
  *[Symbol.iterator](): IterableIterator<[string, unknown]> {
    for (const name of this.keys()) {
      yield [name, this.fetchValue(name)];
    }
  }

  entries(): IterableIterator<[string, unknown]> {
    return this[Symbol.iterator]();
  }
}

/**
 * Builds an AttributeSet from type definitions and raw values.
 *
 * Mirrors: ActiveModel::AttributeSet::Builder
 */
export class Builder {
  readonly types: Map<string, Type>;
  readonly defaultAttributes: Map<string, Attribute>;

  constructor(types: Map<string, Type>, defaultAttributes: Map<string, Attribute> = new Map()) {
    this.types = types;
    this.defaultAttributes = defaultAttributes;
  }

  buildFromDatabase(values: Record<string, unknown> = {}): AttributeSet {
    const attrs = new Map<string, Attribute>();

    for (const [name, type] of this.types) {
      if (name in values) {
        attrs.set(name, Attribute.fromDatabase(name, values[name], type));
      } else {
        const defaultAttr = this.defaultAttributes.get(name);
        if (defaultAttr) {
          attrs.set(
            name,
            Object.assign(Object.create(Object.getPrototypeOf(defaultAttr)), defaultAttr),
          );
        } else {
          attrs.set(name, Attribute.uninitialized(name, type));
        }
      }
    }

    return new AttributeSet(attrs);
  }
}
