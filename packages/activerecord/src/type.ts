/**
 * Mirrors: ActiveRecord::Type
 *
 * Re-exports ActiveModel types under ActiveRecord::Type and adds
 * AR-specific types (Date, DateTime, Time with timezone, Text, Json, etc.).
 */
import {
  Type,
  BigIntegerType,
  BinaryType,
  BooleanType,
  DecimalType,
  FloatType,
  IntegerType,
  ImmutableStringType,
  StringType,
  ValueType,
} from "@blazetrails/activemodel";
export { Type } from "@blazetrails/activemodel";
import { AdapterSpecificRegistry } from "./type/adapter-specific-registry.js";
import { Date } from "./type/date.js";
import { DateTime } from "./type/date-time.js";
import { Time } from "./type/time.js";
import { Text } from "./type/text.js";
import { Json } from "./type/json.js";

export { Date } from "./type/date.js";
export { DateTime } from "./type/date-time.js";
export { Time, TimeValue } from "./type/time.js";
export { Text } from "./type/text.js";
export { Json } from "./type/json.js";
export { Serialized } from "./type/serialized.js";
export { DecimalWithoutScale } from "./type/decimal-without-scale.js";
export { UnsignedInteger } from "./type/unsigned-integer.js";
export { TypeMap } from "./type/type-map.js";
export { HashLookupTypeMap } from "./type/hash-lookup-type-map.js";
export {
  AdapterSpecificRegistry,
  Registration,
  DecorationRegistration,
  TypeConflictError,
} from "./type/adapter-specific-registry.js";

export const BigInteger = BigIntegerType;
export const Binary = BinaryType;
export const Boolean = BooleanType;
export const Decimal = DecimalType;
export const Float = FloatType;
export const Integer = IntegerType;
export const ImmutableString = ImmutableStringType;
export const String = StringType;
export const Value = ValueType;

const registry = new AdapterSpecificRegistry();

registry.register("big_integer", BigIntegerType, { override: false });
registry.register("binary", BinaryType, { override: false });
registry.register("boolean", BooleanType, { override: false });
registry.register("date", Date, { override: false });
registry.register("datetime", DateTime, { override: false });
registry.register("decimal", DecimalType, { override: false });
registry.register("float", FloatType, { override: false });
registry.register("integer", IntegerType, { override: false });
registry.register("immutable_string", ImmutableStringType, { override: false });
registry.register("json", Json, { override: false });
registry.register("string", StringType, { override: false });
registry.register("text", Text, { override: false });
registry.register("time", Time, { override: false });

export { registry };

export function register(
  typeName: string,
  klass?: (new (...args: any[]) => Type) | null,
  options?: { adapter?: string; override?: boolean },
  block?: (...args: unknown[]) => Type,
): void {
  registry.register(typeName, klass, options, block);
}

export function lookup(symbol: string, options?: { adapter?: string }): Type {
  return registry.lookup(symbol, options);
}

export function defaultValue(): Type {
  return new ValueType();
}
