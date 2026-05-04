import { IntegerType } from "@blazetrails/activemodel";

/**
 * Integer type that only allows unsigned (non-negative) values.
 *
 * Mirrors: ActiveRecord::Type::UnsignedInteger. Rails overrides
 * `min_value` to `0` and doubles the signed max via `max_value`.
 * The parent cast raises RangeError for out-of-range values; in TS
 * we catch that and return null instead.
 */
export class UnsignedInteger extends IntegerType {
  protected override maxValue(): number {
    return super.maxValue() * 2;
  }

  protected override minValue(): number {
    return 0;
  }

  override cast(value: unknown): number | null {
    const result = super.cast(value);
    if (result === null) return null;
    return result < 0 ? null : result;
  }

  override isSerializable(value: unknown): boolean {
    return value == null || this.cast(value) !== null;
  }
}
