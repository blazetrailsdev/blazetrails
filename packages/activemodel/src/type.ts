import { typeRegistry } from "./type/registry.js";
import { ValueType } from "./type/value.js";

export * as Type from "./type/value.js";

export function registry(): typeof typeRegistry {
  return typeRegistry;
}

export function register(name: string, factory: () => unknown): void {
  typeRegistry.register(name, factory as never);
}

export function lookup(name: string): unknown {
  return typeRegistry.lookup(name);
}

let _defaultValue: ValueType | null = null;

export function defaultValue(): ValueType {
  return (_defaultValue ??= new ValueType());
}
