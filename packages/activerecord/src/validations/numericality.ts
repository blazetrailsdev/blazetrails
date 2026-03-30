/**
 * Mirrors: ActiveRecord::Validations::NumericalityValidator
 *
 * Extends ActiveModel's NumericalityValidator. In ActiveRecord, this
 * uses the column's type-cast value for comparison rather than the
 * raw string, enabling correct numeric comparison for database columns.
 */
import { NumericalityValidator as BaseNumericalityValidator } from "@blazetrails/activemodel";

export class NumericalityValidator extends BaseNumericalityValidator {}
