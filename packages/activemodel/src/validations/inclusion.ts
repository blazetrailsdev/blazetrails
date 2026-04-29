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
 * Mirrors: ActiveModel::Validations::InclusionValidator (inclusion.rb)
 *
 *   class InclusionValidator < EachValidator
 *     include Clusivity
 *     def validate_each(record, attribute, value)
 *       unless include?(record, value)
 *         record.errors.add(attribute, :inclusion,
 *           **options.except(:in, :within).merge!(value: value))
 *       end
 *     end
 *   end
 *
 * `nil`/`undefined` are NOT pre-skipped here — Rails relies on
 * EachValidator's allow_nil dispatch (validator.ts:100) so the option
 * keeps its Rails-faithful "only skip when allow_nil: true" semantics.
 */
export class InclusionValidator extends EachValidator {
  resolveValue = resolveValue;
  delimiter = delimiter;
  inclusionMethod = inclusionMethod;
  isInclude = isInclude;

  override checkValidity(): void {
    checkValidityBang.call(this);
  }

  validateEach(record: AnyRecord, attribute: string, value: unknown): void {
    if (!this.isInclude(record, value)) {
      record.errors.add(attribute, "inclusion", exceptInWithinMergeValue(this.options, value));
    }
  }
}
