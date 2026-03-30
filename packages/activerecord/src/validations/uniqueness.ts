/**
 * Mirrors: ActiveRecord::Validations::UniquenessValidator
 *
 * Validates that the specified attribute value is unique in the database.
 * Builds a query against the model's table to check for existing records
 * with the same value, optionally scoped to other columns.
 *
 *   class User extends Base {
 *     static { this.validatesUniquenessOf("email"); }
 *   }
 *
 * Options:
 *   scope    - Additional columns to scope the uniqueness check
 *   caseSensitive - Whether to perform case-sensitive comparison (default: true)
 *   conditions - A callable that adds additional conditions to the query
 */
import { EachValidator } from "@blazetrails/activemodel";

export class UniquenessValidator extends EachValidator {
  validateEach(record: any, attribute: string, value: unknown): void {
    const modelClass = record.constructor as any;
    if (!modelClass.where) return;

    let relation = modelClass.where({ [attribute]: value });

    if (record.persisted?.()) {
      const pk = modelClass.primaryKey ?? "id";
      relation = relation.whereNot({ [pk]: record.readAttribute(pk) });
    }

    const opts = this.options as any;
    if (opts?.scope) {
      const scopes = Array.isArray(opts.scope) ? opts.scope : [opts.scope];
      for (const scopeAttr of scopes) {
        relation = relation.where({ [scopeAttr]: record.readAttribute(scopeAttr) });
      }
    }

    if (opts?.conditions && typeof opts.conditions === "function") {
      relation = opts.conditions(relation);
    }

    relation.exists().then((exists: boolean) => {
      if (exists) {
        record.errors.add(attribute, "taken", { value });
      }
    });
  }
}
