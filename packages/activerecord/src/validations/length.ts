/**
 * Mirrors: ActiveRecord::Validations::LengthValidator
 *
 * Extends ActiveModel's LengthValidator. In ActiveRecord, this adds
 * awareness of serialized/encrypted attributes whose in-database
 * representation may differ in length from the in-memory value.
 */
import { LengthValidator as BaseLengthValidator } from "@blazetrails/activemodel";

export class LengthValidator extends BaseLengthValidator {}
