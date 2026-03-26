/**
 * Represents an error related to a missing attribute.
 *
 * Mirrors: ActiveModel::MissingAttributeError
 */
export class MissingAttributeError extends globalThis.Error {
  constructor(message?: string) {
    super(message);
    this.name = "MissingAttributeError";
  }
}

/**
 * Represents a pattern for matching attribute method names.
 *
 * Mirrors: ActiveModel::AttributeMethods::ClassMethods::AttributeMethodPattern
 */
export class AttributeMethodPattern {
  readonly prefix: string;
  readonly suffix: string;
  readonly method_missing_target: string;

  constructor(prefix: string = "", suffix: string = "") {
    this.prefix = prefix;
    this.suffix = suffix;
    this.method_missing_target = `attribute_${prefix}${suffix ? `${suffix}` : ""}`;
  }

  match(method: string): { attr: string } | null {
    if (this.prefix && !method.startsWith(this.prefix)) return null;
    if (this.suffix && !method.endsWith(this.suffix)) return null;
    const attr = method.slice(this.prefix.length, this.suffix ? -this.suffix.length : undefined);
    return attr ? { attr } : null;
  }

  methodName(attrName: string): string {
    return `${this.prefix}${attrName}${this.suffix}`;
  }
}

export interface AttributeMethods {
  attributeMissing(name: string): unknown;
  respondTo(method: string): boolean;
}

export interface AttributeMethodsClassMethods {
  attributeMethodPrefix(...prefixes: string[]): void;
  attributeMethodSuffix(...suffixes: string[]): void;
  aliasAttribute(newName: string, oldName: string): void;
  defineAttributeMethods(...attrNames: string[]): void;
  defineAttributeMethod(attrName: string): void;
  undefineAttributeMethods(): void;
}

export interface AttrNames {
  defineAttributeAccessorMethod(name: string): void;
}
