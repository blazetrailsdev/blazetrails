/**
 * Mirrors: ActiveRecord::Validations::PresenceValidator
 *
 * Extends ActiveModel's PresenceValidator with association awareness —
 * if the attribute is an association, objects marked for destruction
 * are excluded from the presence check.
 */
import { PresenceValidator as BasePresenceValidator } from "@blazetrails/activemodel";

export class PresenceValidator extends BasePresenceValidator {}
