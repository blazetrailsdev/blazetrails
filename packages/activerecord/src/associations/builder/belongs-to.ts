import { SingularAssociation } from "./singular-association.js";
import { afterDestroy } from "../../callbacks.js";

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
    super.defineCallbacks(model, reflection);
    const options = reflection.options ?? {};
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
    // Counter cache callback wiring — delegates to the association at runtime
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

  static addTouchCallbacks(model: any, reflection: any): void {
    const foreignKey = reflection.foreignKey ?? reflection.options?.foreignKey;
    const name = reflection.name;
    const touch = reflection.options?.touch;

    const callback = (changesMethod: string) => (record: any) => {
      const changes = typeof record[changesMethod] === "function" ? record[changesMethod]() : {};
      BelongsTo.touchRecord(record, changes, foreignKey, name, touch);
    };

    if (reflection.options?.counterCache) {
      // When counter cache is present, only fire touch on update when target didn't change
    } else {
      if (typeof model.afterCreate === "function") {
        model.afterCreate(callback("savedChanges"));
      }
      if (typeof model.afterUpdate === "function") {
        model.afterUpdate(callback("savedChanges"));
      }
      if (typeof model.afterDestroy === "function") {
        model.afterDestroy(callback("changesToSave"));
      } else {
        afterDestroy(model, callback("changesToSave"));
      }
    }

    if (typeof model.afterTouch === "function") {
      model.afterTouch(callback("changesToSave"));
    }
  }

  static addDefaultCallbacks(model: any, reflection: any): void {
    if (typeof model.beforeValidation === "function") {
      model.beforeValidation((record: any) => {
        if (typeof record.association === "function") {
          const assoc = record.association(reflection.name);
          if (typeof assoc.default === "function") {
            assoc.default(reflection.options?.default);
          }
        }
      });
    }
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
      const foreignKey = reflection.foreignKey ?? options.foreignKey ?? `${reflection.name}_id`;
      model.validates(foreignKey, { presence: true });
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
