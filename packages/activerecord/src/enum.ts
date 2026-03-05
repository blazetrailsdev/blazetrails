import type { Base } from "./base.js";

/**
 * Enum definition — maps symbolic names to integer values.
 *
 * Mirrors: ActiveRecord::Enum
 */

interface EnumDefinition {
  attribute: string;
  mapping: Map<string, number>;
  reverseMapping: Map<number, string>;
}

/**
 * Registry of enum definitions per model class.
 */
const enumRegistry = new WeakMap<typeof Base, Map<string, EnumDefinition>>();

/**
 * Get enum definitions for a model class.
 */
export function getEnumDefinitions(
  modelClass: typeof Base
): Map<string, EnumDefinition> {
  if (!enumRegistry.has(modelClass)) {
    enumRegistry.set(modelClass, new Map());
  }
  return enumRegistry.get(modelClass)!;
}

/**
 * Define an enum on a model class.
 *
 * Supports:
 *   - Array form: enum('status', ['draft', 'published', 'archived'])
 *   - Object form: enum('status', { draft: 0, published: 1, archived: 2 })
 *
 * Generates:
 *   - Predicate methods: record.isDraft(), record.isPublished()
 *   - Setter methods: record.draft(), record.published()
 *   - Scopes: Model.draft(), Model.published()
 *   - The attribute getter returns the string name, setter accepts string or number
 *
 * Mirrors: ActiveRecord::Enum.enum
 */
export function defineEnum(
  modelClass: typeof Base,
  attribute: string,
  valuesInput: string[] | Record<string, number>
): void {
  const mapping = new Map<string, number>();
  const reverseMapping = new Map<number, string>();

  if (Array.isArray(valuesInput)) {
    valuesInput.forEach((name, index) => {
      mapping.set(name, index);
      reverseMapping.set(index, name);
    });
  } else {
    for (const [name, value] of Object.entries(valuesInput)) {
      mapping.set(name, value);
      reverseMapping.set(value, name);
    }
  }

  const defs = getEnumDefinitions(modelClass);
  const def: EnumDefinition = { attribute, mapping, reverseMapping };
  defs.set(attribute, def);

  // Define scopes for each enum value
  for (const [name, value] of mapping) {
    modelClass.scope(name, (rel: any) => rel.where({ [attribute]: value }));
  }

  // Define instance methods on the prototype
  for (const [name, value] of mapping) {
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

    // Predicate: record.isDraft()
    Object.defineProperty(modelClass.prototype, `is${capitalizedName}`, {
      value: function (this: Base) {
        return this.readAttribute(attribute) === value;
      },
      writable: true,
      configurable: true,
    });

    // Setter: record.draft() — sets the value in memory
    if (!modelClass.prototype.hasOwnProperty(name)) {
      Object.defineProperty(modelClass.prototype, name, {
        value: function (this: Base) {
          this.writeAttribute(attribute, value);
        },
        writable: true,
        configurable: true,
      });
    }

    // Bang setter: record.draftBang() — sets and persists via updateColumn
    const bangName = `${name}Bang`;
    Object.defineProperty(modelClass.prototype, bangName, {
      value: async function (this: any) {
        this.writeAttribute(attribute, value);
        if (this.isPersisted()) {
          await this.updateColumn(attribute, value);
        }
      },
      writable: true,
      configurable: true,
    });

    // whereNot scope: Model.notDraft() → where.not(status: value)
    const notScopeName = `not${capitalizedName}`;
    modelClass.scope(notScopeName, (rel: any) => rel.whereNot({ [attribute]: value }));
  }
}

/**
 * Get the human-readable enum value for an attribute.
 */
export function readEnumValue(record: Base, attribute: string): string | null {
  const ctor = record.constructor as typeof Base;
  const defs = getEnumDefinitions(ctor);
  const def = defs.get(attribute);
  if (!def) return null;

  const numericValue = record.readAttribute(attribute);
  if (numericValue === null || numericValue === undefined) return null;
  return def.reverseMapping.get(Number(numericValue)) ?? null;
}

/**
 * Cast an enum value (string name or number) to its integer storage value.
 */
export function castEnumValue(
  modelClass: typeof Base,
  attribute: string,
  value: unknown
): number | null {
  const defs = getEnumDefinitions(modelClass);
  const def = defs.get(attribute);
  if (!def) return null;

  if (typeof value === "string") {
    return def.mapping.get(value) ?? null;
  }
  if (typeof value === "number") {
    return def.reverseMapping.has(value) ? value : null;
  }
  return null;
}
