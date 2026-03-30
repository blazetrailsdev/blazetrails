/**
 * Mirrors: ActiveRecord::Validations::AbsenceValidator
 *
 * Extends ActiveModel's AbsenceValidator with association awareness —
 * if the attribute is an association, objects marked for destruction
 * are excluded from the presence check.
 */
import { AbsenceValidator as BaseAbsenceValidator } from "@blazetrails/activemodel";

export class AbsenceValidator extends BaseAbsenceValidator {}
