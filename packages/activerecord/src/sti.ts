import type { Base } from "./base.js";
import { modelRegistry } from "./associations.js";

/**
 * Register a class as a subclass of its parent.
 * Call this in a static initializer block on subclasses to enable
 * subclasses/descendants tracking.
 *
 * Mirrors the implicit subclass registration Rails does via Ruby's
 * inherited hook.
 */
export function registerSubclass(klass: typeof Base): void {
  const parent = Object.getPrototypeOf(klass) as typeof Base;
  if (!parent || parent === Function.prototype) return;
  if (!Object.prototype.hasOwnProperty.call(parent, "_subclasses")) {
    (parent as any)._subclasses = [];
  }
  (parent as any)._subclasses.push(klass);
}

/**
 * Single Table Inheritance support.
 *
 * When a model has an inheritance column (default: "type"), subclasses
 * share the parent's table and auto-set the type column.
 *
 * Mirrors: ActiveRecord::Inheritance
 */

/**
 * Configure STI on a base model class.
 * Call this on the parent class to enable STI.
 */
export function enableSti(
  modelClass: typeof Base,
  options: { column?: string } = {}
): void {
  const column = options.column ?? "type";
  (modelClass as any)._inheritanceColumn = column;
}

/**
 * Get the inheritance column for a model, if STI is enabled.
 */
export function getInheritanceColumn(
  modelClass: typeof Base
): string | null {
  return (modelClass as any)._inheritanceColumn ?? null;
}

/**
 * Check if a model class is an STI subclass (not the base STI class).
 */
export function isStiSubclass(modelClass: typeof Base): boolean {
  // Walk up the prototype chain to find if any parent has _inheritanceColumn
  let current = Object.getPrototypeOf(modelClass);
  while (current && current !== Function.prototype) {
    if ((current as any)._inheritanceColumn) return true;
    current = Object.getPrototypeOf(current);
  }
  return false;
}

/**
 * Get the STI base class for a model.
 */
export function getStiBase(modelClass: typeof Base): typeof Base {
  let current = modelClass;
  let base = modelClass;
  while (current && current !== Function.prototype) {
    if ((current as any)._inheritanceColumn) {
      base = current;
    }
    current = Object.getPrototypeOf(current) as typeof Base;
  }
  return base;
}

/**
 * Instantiate the correct STI subclass from a database row.
 */
export function instantiateSti(
  baseClass: typeof Base,
  row: Record<string, unknown>
): Base {
  const column = getInheritanceColumn(baseClass);
  if (!column) return baseClass._instantiate(row);

  const typeName = row[column] as string | null | undefined;
  if (!typeName) return baseClass._instantiate(row);

  const subclass = modelRegistry.get(typeName);
  if (!subclass) return baseClass._instantiate(row);

  return subclass._instantiate(row);
}
