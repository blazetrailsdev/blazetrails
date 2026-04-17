/**
 * Mirrors: ActiveRecord::Type::DecimalWithoutScale
 *
 * Rails: `class DecimalWithoutScale < ActiveModel::Type::BigInteger;
 * def type; :decimal; end; def type_cast_for_schema(value);
 * value.to_s.inspect; end`. Used for NUMERIC columns declared without
 * a scale — the value is an integer but reports as a decimal.
 */

import { BigIntegerType } from "@blazetrails/activemodel";

export class DecimalWithoutScale extends BigIntegerType {
  override readonly name: string = "decimal";

  override type(): string {
    return "decimal";
  }

  override typeCastForSchema(value: unknown): string {
    // Rails: `value.to_s.inspect`. nil.to_s is "", so null/undefined
    // should render as "" (quoted empty string), not "null"/"undefined".
    const s = value == null ? "" : String(value);
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
}
