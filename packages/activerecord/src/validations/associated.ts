/**
 * Mirrors: ActiveRecord::Validations::AssociatedValidator
 *
 * Validates that all associated objects are valid. Works with
 * any kind of association (has_many, has_one, belongs_to).
 *
 *   class Book extends Base {
 *     static { this.hasMany("pages"); this.validatesAssociated("pages"); }
 *   }
 */
import { EachValidator } from "@blazetrails/activemodel";

export class AssociatedValidator extends EachValidator {
  validateEach(record: any, attribute: string, value: unknown): void {
    // Fetch association value — readAttribute won't have it since
    // associations aren't stored in the attributes hash.
    let associationValue = value;
    if (associationValue == null) {
      if (typeof record.association === "function") {
        const assoc = record.association(attribute);
        associationValue = assoc?.target ?? assoc;
      } else if (attribute in record) {
        associationValue = record[attribute];
      }
    }

    const values = Array.isArray(associationValue)
      ? associationValue
      : associationValue
        ? [associationValue]
        : [];
    for (const assoc of values) {
      if (assoc?.markedForDestruction?.()) continue;
      if (typeof assoc?.isValid === "function" && !assoc.isValid()) {
        record.errors.add(attribute, "invalid", { value: associationValue });
        return;
      }
    }
  }
}
