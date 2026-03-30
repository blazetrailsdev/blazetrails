/**
 * Mirrors: ActiveRecord::Type::UnsignedInteger
 */
import { IntegerType } from "@blazetrails/activemodel";

export class UnsignedInteger extends IntegerType {
  readonly name = "integer";

  cast(value: unknown): number | null {
    const result = super.cast(value);
    if (result === null) return null;
    if (result < 0) return 0;
    return result;
  }
}
