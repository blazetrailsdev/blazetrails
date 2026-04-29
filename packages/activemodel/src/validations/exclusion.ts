import { EachValidator } from "../validator.js";
import type { AnyRecord } from "../validator.js";
import {
  checkValidityBang,
  delimiter,
  exceptInWithinMergeValue,
  inclusionMethod,
  isInclude,
  resolveValue,
} from "./clusivity.js";

/**
 * Mirrors: ActiveModel::Validations::ExclusionValidator (exclusion.rb)
 *
 *   class ExclusionValidator < EachValidator
 *     include Clusivity
 *     def validate_each(record, attribute, value)
 *       if include?(record, value)
 *         record.errors.add(attribute, :exclusion,
 *           **options.except(:in, :within).merge!(value: value))
 *       end
 *     end
 *   end
 *
 * `nil`/`undefined` are NOT pre-skipped here — Rails relies on
 * EachValidator's allow_nil dispatch (validator.ts:100) so excluding
 * `nil` works when the excluded set explicitly contains it.
 */
export class ExclusionValidator extends EachValidator {
  resolveValue = resolveValue;
  delimiter = delimiter;
  inclusionMethod = inclusionMethod;
  isInclude = isInclude;

  override checkValidity(): void {
    checkValidityBang.call(this);
  }

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    if (this.isInclude(record, value)) {
      record.errors.add(attribute, "exclusion", exceptInWithinMergeValue(this.options, value));
    }
  }
}
