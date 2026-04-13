/**
 * Mirrors: ActiveRecord::Validations::LengthValidator
 *
 * Extends ActiveModel's LengthValidator with association awareness —
 * if the value responds to loaded? and is loaded, records marked for
 * destruction are excluded from the length count.
 */
import { LengthValidator as BaseLengthValidator } from "@blazetrails/activemodel";

export class LengthValidator extends BaseLengthValidator {
  validateEach(record: any, attribute: string, value: unknown): void {
    let associationOrValue = value;
    // Rails: association_or_value.respond_to?(:loaded?) && association_or_value.loaded?
    if (value != null && typeof (value as any).loaded === "function" && (value as any).loaded()) {
      const target: any[] = (value as any).target ?? [];
      associationOrValue = target.filter(
        (v: any) => !(typeof v?.markedForDestruction === "function" && v.markedForDestruction()),
      );
    }
    super.validateEach(record, attribute, associationOrValue);
  }
}
