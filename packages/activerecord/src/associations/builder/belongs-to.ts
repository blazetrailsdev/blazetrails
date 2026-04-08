import { underscore } from "@blazetrails/activesupport";
import { SingularAssociation } from "./singular-association.js";
import { afterDestroy, beforeValidation } from "../../callbacks.js";

/**
 * Mirrors: ActiveRecord::Associations::Builder::BelongsTo
 */
export class BelongsTo extends SingularAssociation {
  static override macro(): string {
    return "belongsTo";
  }

  static override validOptions(options: Record<string, unknown>): string[] {
    const valid = [
      ...super.validOptions(options),
      "polymorphic",
      "counterCache",
      "optional",
      "default",
    ];
    if (options.polymorphic) valid.push("foreignType");
    if (options.dependent === "destroyAsync") valid.push("ensuringOwnerWas");
    return valid;
  }

  static override validDependentOptions(): string[] {
    return ["destroy", "delete", "destroyAsync"];
  }

  static override defineCallbacks(model: any, reflection: any): void {
    const options = reflection.options ?? {};
    const dependent = options.dependent;
    if (dependent) {
      this.addDestroyCallbacks(model, reflection);
      this.addAfterCommitJobsCallback(model, dependent as string);
    }
    for (const extension of this.extensions) {
      if (typeof extension.build === "function") {
        extension.build(model, reflection);
      }
    }
    if (options.counterCache) {
      this.addCounterCacheCallbacks(model, reflection);
    }
    if (options.touch) {
      this.addTouchCallbacks(model, reflection);
    }
    if (options.default != null) {
      this.addDefaultCallbacks(model, reflection);
    }
  }

  static addCounterCacheCallbacks(_model: any, _reflection: any): void {
    // Counter cache callbacks are handled centrally by updateCounterCaches()
    // in associations.ts, called from Base#_createOrUpdate and Base#_destroyRow.
    // Rails registers per-association after_update callbacks here, but our
    // architecture centralizes counter cache handling via BelongsToAssociation
    // instance methods (incrementCounters, decrementCountersBeforeLastSave).
  }

  static touchRecord(
    record: any,
    changes: Record<string, any>,
    foreignKey: string,
    name: string,
    touch: any,
  ): void {
    const oldForeignId = changes[foreignKey]?.[0];

    if (oldForeignId != null) {
      const association =
        typeof record.association === "function" ? record.association(name) : null;
      if (association) {
        const reflection = association.reflection;
        let klass: any;
        if (reflection?.isPolymorphic?.()) {
          const foreignType = reflection.foreignType;
          const typeName = changes[foreignType]?.[0] ?? record[foreignType];
          klass = record.constructor.polymorphicClassFor?.(typeName) ?? null;
        } else {
          klass = association.klass;
        }
        if (klass) {
          const pk = reflection?.associationPrimaryKey?.(klass) ?? "id";
          const oldRecord =
            typeof klass.findBy === "function" ? klass.findBy({ [pk]: oldForeignId }) : null;
          if (oldRecord) {
            if (touch !== true && typeof oldRecord.touchLater === "function") {
              oldRecord.touchLater(touch);
            } else if (typeof oldRecord.touchLater === "function") {
              oldRecord.touchLater();
            }
          }
        }
      }
    }

    const related = typeof record[name] === "function" ? record[name]() : record[name];
    if (related && typeof related.isPersisted === "function" && related.isPersisted()) {
      if (touch !== true && typeof related.touchLater === "function") {
        related.touchLater(touch);
      } else if (typeof related.touchLater === "function") {
        related.touchLater();
      }
    }
  }

  static addTouchCallbacks(_model: any, _reflection: any): void {
    // Touch callbacks are handled by touchBelongsToParents() in
    // associations.ts, called from Base#_createOrUpdate and Base#_destroyRow.
    // Rails registers per-association after_create/after_update/after_destroy
    // callbacks here, but our architecture centralizes touch handling.
  }

  static addDefaultCallbacks(model: any, reflection: any): void {
    beforeValidation(model, (record: any) => {
      if (typeof record.association === "function") {
        const assoc = record.association(reflection.name);
        if (typeof assoc.default === "function") {
          assoc.default(reflection.options?.default);
        }
      }
    });
  }

  static override addDestroyCallbacks(model: any, reflection: any): void {
    const name = reflection.name ?? reflection;
    afterDestroy(model, (record: any) => {
      if (typeof record.association === "function") {
        const assoc = record.association(name);
        if (typeof assoc.handleDependency === "function") {
          assoc.handleDependency();
        }
      }
    });
  }

  static override defineValidations(model: any, reflection: any): void {
    const options = reflection.options ?? {};

    if ("required" in options) {
      options.optional = !options.required;
      delete options.required;
    }

    let required: boolean;
    if (options.optional == null) {
      required = !!(model.belongsToRequiredByDefault ?? false);
    } else {
      required = !options.optional;
    }

    super.defineValidations(model, reflection);

    if (required && typeof model.validates === "function") {
      const fk = reflection.foreignKey ?? options.foreignKey ?? `${underscore(reflection.name)}_id`;

      if (model.belongsToRequiredValidatesForeignKey ?? true) {
        model.validates(fk, { presence: true });
      } else {
        const condition = (record: any) => {
          return (
            record.readAttribute(fk) == null ||
            (typeof record.attributeChanged === "function" && record.attributeChanged(fk)) ||
            (reflection.options?.polymorphic &&
              (() => {
                const ft = reflection.foreignType ?? `${underscore(reflection.name)}_type`;
                return (
                  record.readAttribute(ft) == null ||
                  (typeof record.attributeChanged === "function" && record.attributeChanged(ft))
                );
              })())
          );
        };
        model.validates(fk, { presence: { if: condition } });
      }
    }
  }

  static override defineChangeTrackingMethods(model: any, reflection: any): void {
    const mixin =
      typeof model.generatedAssociationMethods === "function"
        ? model.generatedAssociationMethods()
        : null;
    if (mixin instanceof Set) {
      const name = reflection.name ?? reflection;
      mixin.add(`${name}Changed`);
      mixin.add(`${name}PreviouslyChanged`);
    }
  }
}
