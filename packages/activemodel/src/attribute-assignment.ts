import { ForbiddenAttributesError } from "./forbidden-attributes-protection.js";
import { UnknownAttributeError } from "./errors.js";

interface PermittedAttributes {
  permitted?(): boolean;
}

function sanitizeForMassAssignment(attributes: Record<string, unknown>): Record<string, unknown> {
  const attrs = attributes as Record<string, unknown> & PermittedAttributes;
  if (typeof attrs.permitted === "function") {
    if (!attrs.permitted()) {
      throw new ForbiddenAttributesError();
    }
  }
  return attributes;
}

export interface AttributeAssignment {
  writeAttribute(name: string, value: unknown): void;
  attributeWriterMissing?(name: string, value: unknown): void;
}

function typeNameForError(value: unknown): string {
  if (value === null) return "Null";
  if (Array.isArray(value)) return "Array";
  const t = typeof value;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function assignAttributes(model: AttributeAssignment, newAttributes: unknown): void {
  if (typeof newAttributes !== "object" || newAttributes === null || Array.isArray(newAttributes)) {
    throw new ArgumentError(
      `When assigning attributes, you must pass a hash as an argument, ${typeNameForError(newAttributes)} passed.`,
    );
  }

  const attrs = newAttributes as Record<string, unknown>;
  if (Object.keys(attrs).length === 0) return;

  const sanitized = sanitizeForMassAssignment(attrs);

  for (const [key, value] of Object.entries(sanitized)) {
    assignAttribute(model, key, value);
  }
}

/**
 * Walk the prototype chain looking for a setter descriptor for `key`.
 * Mirrors Rails' `public_send("#{k}=", v)` dispatch
 * (activemodel/lib/active_model/attribute_assignment.rb:67-70), which
 * routes through any user-defined `attr_writer` / `def name=` before
 * the attribute store sees the value.
 *
 * Model.prototype itself defines no per-attribute setters, so lookup
 * only finds setters that user subclasses added explicitly.
 */
function findSetter(model: object, key: string): ((this: object, value: unknown) => void) | null {
  let proto: object | null = Object.getPrototypeOf(model);
  while (proto && proto !== Object.prototype) {
    const desc = Object.getOwnPropertyDescriptor(proto, key);
    if (desc && typeof desc.set === "function") {
      return desc.set as (this: object, value: unknown) => void;
    }
    proto = Object.getPrototypeOf(proto);
  }
  return null;
}

function assignAttribute(model: AttributeAssignment, key: string, value: unknown): void {
  const setter = findSetter(model, key);
  if (setter) {
    setter.call(model, value);
    return;
  }
  try {
    model.writeAttribute(key, value);
  } catch (error) {
    if (error instanceof UnknownAttributeError) {
      if (typeof model.attributeWriterMissing === "function") {
        model.attributeWriterMissing(key, value);
      } else {
        attributeWriterMissing(model, key, value);
      }
    } else {
      throw error;
    }
  }
}

export function attributeWriterMissing(
  model: AttributeAssignment,
  name: string,
  _value: unknown,
): void {
  throw new UnknownAttributeError(model, name);
}

class ArgumentError extends globalThis.Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentError";
  }
}

export { ArgumentError };
