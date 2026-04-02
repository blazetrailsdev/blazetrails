/**
 * AttributeMethods mixin contract — dynamic attribute method generation.
 *
 * Mirrors: ActiveModel::AttributeMethods
 *
 * In Rails, this module provides attribute_method_prefix/suffix/affix,
 * alias_attribute, define_attribute_methods, etc. as ClassMethods.
 * Model delegates to the functions exported here.
 */
export interface AttributeMethods {
  hasAttribute(name: string): boolean;
  attributePresent(name: string): boolean;
  attributeMissing(name: string): unknown;
  respondTo(method: string): boolean;
}

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
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace AttrNames {
  const DEF_SAFE_NAME = /^[a-zA-Z_]\w*$/;

  export function defineAttributeAccessorMethod(
    attrName: string,
    writer: boolean = false,
  ): { methodName: string; attrNameRef: string } {
    const methodName = writer ? `${attrName}=` : attrName;
    if (DEF_SAFE_NAME.test(attrName)) {
      return { methodName, attrNameRef: `'${attrName}'` };
    }
    const escaped = attrName
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n");
    return { methodName, attrNameRef: `'${escaped}'` };
  }
}

export class AttributeMethodPattern {
  readonly prefix: string;
  readonly suffix: string;
  readonly proxyTarget: string;
  readonly parameters: string;
  readonly method_missing_target: string;

  constructor(prefix: string = "", suffix: string = "", parameters?: string) {
    this.prefix = prefix;
    this.suffix = suffix;
    this.parameters = parameters === undefined ? "..." : parameters;
    this.proxyTarget = `${prefix}attribute${suffix}`;
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

// ---------------------------------------------------------------------------
// AttributeMethods ClassMethods — extracted from Model for Rails parity
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = any;

/**
 * The static side contract for a class that uses attribute method generation.
 * Model satisfies this interface.
 */
export interface AttributeMethodHost {
  _attributeDefinitions: Map<string, { name: string }>;
  _attributeMethodPatterns: AttributeMethodPattern[];
  _attributeAliases: Record<string, string>;
  _aliasesByAttributeName: Map<string, string[]>;
  prototype: AnyRecord;
}

export function attributeMethodPrefix(host: AttributeMethodHost, ...prefixes: string[]): void {
  for (const prefix of prefixes) {
    host._attributeMethodPatterns.push(new AttributeMethodPattern(prefix, ""));
  }
  undefineAttributeMethods(host);
  defineAttributeMethods(host, ...Array.from(host._attributeDefinitions.keys()));
}

export function attributeMethodSuffix(host: AttributeMethodHost, ...suffixes: string[]): void {
  for (const suffix of suffixes) {
    host._attributeMethodPatterns.push(new AttributeMethodPattern("", suffix));
  }
  undefineAttributeMethods(host);
  defineAttributeMethods(host, ...Array.from(host._attributeDefinitions.keys()));
}

export function attributeMethodAffix(
  host: AttributeMethodHost,
  ...affixes: Array<{ prefix: string; suffix: string }>
): void {
  for (const { prefix, suffix } of affixes) {
    host._attributeMethodPatterns.push(new AttributeMethodPattern(prefix, suffix));
  }
  undefineAttributeMethods(host);
  defineAttributeMethods(host, ...Array.from(host._attributeDefinitions.keys()));
}

export function aliasAttribute(host: AttributeMethodHost, newName: string, oldName: string): void {
  host._attributeAliases = { ...host._attributeAliases, [newName]: oldName };
  const aliases = aliasesByAttributeName(host);
  if (!aliases.has(oldName)) aliases.set(oldName, []);
  aliases.get(oldName)!.push(newName);

  // Always define the direct alias property (bare name → original)
  Object.defineProperty(host.prototype, newName, {
    get(this: AnyRecord) {
      return this.readAttribute(oldName);
    },
    set(this: AnyRecord, value: unknown) {
      this.writeAttribute(oldName, value);
    },
    configurable: true,
  });

  // Also generate pattern-based alias methods (e.g., clear_fullName if clear_ prefix exists)
  eagerlyGenerateAliasAttributeMethods(host, newName, oldName);
}

export function eagerlyGenerateAliasAttributeMethods(
  host: AttributeMethodHost,
  newName: string,
  oldName: string,
): void {
  generateAliasAttributeMethods(host, newName, oldName);
}

export function generateAliasAttributeMethods(
  host: AttributeMethodHost,
  newName: string,
  oldName: string,
): void {
  for (const pattern of host._attributeMethodPatterns) {
    aliasAttributeMethodDefinition(host, pattern, newName, oldName);
  }
}

export function aliasAttributeMethodDefinition(
  host: AttributeMethodHost,
  pattern: AttributeMethodPattern,
  newName: string,
  oldName: string,
): void {
  const methodName = pattern.methodName(newName);
  Object.defineProperty(host.prototype, methodName, {
    get(this: AnyRecord) {
      return this.readAttribute(oldName);
    },
    set(this: AnyRecord, value: unknown) {
      this.writeAttribute(oldName, value);
    },
    configurable: true,
  });
}

export function isAttributeAlias(host: AttributeMethodHost, name: string): boolean {
  return name in host._attributeAliases;
}

export function attributeAlias(host: AttributeMethodHost, name: string): string | undefined {
  return host._attributeAliases[name];
}

export function defineAttributeMethods(host: AttributeMethodHost, ...attrNames: string[]): void {
  for (const attrName of attrNames) {
    defineAttributeMethod(host, attrName);
    const aliases = aliasesByAttributeName(host);
    const attrAliases = aliases.get(attrName);
    if (attrAliases) {
      for (const aliasedName of attrAliases) {
        generateAliasAttributeMethods(host, aliasedName, attrName);
      }
    }
  }
}

export function defineAttributeMethod(host: AttributeMethodHost, attrName: string): void {
  for (const pattern of host._attributeMethodPatterns) {
    defineAttributeMethodPattern(host, pattern, attrName);
  }
}

export function defineAttributeMethodPattern(
  host: AttributeMethodHost,
  pattern: AttributeMethodPattern,
  attrName: string,
  options?: { override?: boolean },
): void {
  const methodName = pattern.methodName(attrName);
  if (host.prototype[methodName] !== undefined && !options?.override) return;
  Object.defineProperty(host.prototype, methodName, {
    value: function (this: AnyRecord) {
      return this.readAttribute(attrName);
    },
    writable: true,
    configurable: true,
  });
}

export function undefineAttributeMethods(host: AttributeMethodHost): void {
  for (const [name] of host._attributeDefinitions) {
    for (const pattern of host._attributeMethodPatterns) {
      const methodName = pattern.methodName(name);
      delete host.prototype[methodName];
    }
  }
}

export function aliasesByAttributeName(host: AttributeMethodHost): Map<string, string[]> {
  if (!host._aliasesByAttributeName) {
    host._aliasesByAttributeName = new Map();
  }
  return host._aliasesByAttributeName;
}
