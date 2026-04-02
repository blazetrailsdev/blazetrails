import { Type } from "./type/value.js";

/**
 * AttributeRegistration mixin — provides the static attribute() method
 * and attribute type registration.
 *
 * Mirrors: ActiveModel::AttributeRegistration
 *
 * In Rails this is a module that handles the class-level attribute
 * declaration API. Model already implements this via Model.attribute().
 */
export interface AttributeRegistrationClassMethods {
  attribute(name: string, typeName: string, options?: { default?: unknown }): void;
  decorateAttributes(names: string[] | null, decorator: (name: string, type: Type) => Type): void;
  attributeTypes(): Record<string, Type>;
  typeForAttribute(name: string): Type | null;
}

export type AttributeRegistration = AttributeRegistrationClassMethods;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAttributeHost = any;

export function decorateAttributes(
  host: AnyAttributeHost,
  names: string[] | null,
  decorator: (name: string, type: Type) => Type,
): void {
  if (!Object.prototype.hasOwnProperty.call(host, "_attributeDefinitions")) {
    host._attributeDefinitions = new Map(host._attributeDefinitions);
  }
  const defs = host._attributeDefinitions as Map<string, { name: string; type: Type }>;
  const targetNames = names ?? Array.from(defs.keys());
  for (const name of targetNames) {
    const def = defs.get(name);
    if (def) {
      const newType = decorator(name, def.type);
      if (newType) {
        defs.set(name, { ...def, type: newType });
      }
    }
  }
}

export function attributeTypes(host: AnyAttributeHost): Record<string, Type> {
  const result: Record<string, Type> = {};
  const defs = host._attributeDefinitions as Map<string, { name: string; type: Type }>;
  for (const [name, def] of defs) {
    result[name] = def.type;
  }
  return result;
}

export function typeForAttribute(host: AnyAttributeHost, name: string): Type | null {
  const def = (host._attributeDefinitions as Map<string, { type: Type }>).get(name);
  return def ? def.type : null;
}
