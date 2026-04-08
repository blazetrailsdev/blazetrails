import { underscore } from "@blazetrails/activesupport";
import { SingularAssociation } from "./singular-association.js";
import { beforeValidation, afterCreate, afterUpdate, afterDestroy } from "../../callbacks.js";

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
    // Counter cache is handled by updateCounterCaches() in associations.ts,
    // called from Base#_createOrUpdate and Base#_destroyRow. Migrating to
    // per-association afterCreate/afterUpdate callbacks is tracked as a
    // follow-up to avoid double-counting with the centralized handler.
  }

  static async touchRecord(
    record: any,
    changes: Record<string, any>,
    foreignKey: string,
    name: string,
    touch: any,
  ): Promise<void> {
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
            typeof klass.findBy === "function" ? await klass.findBy({ [pk]: oldForeignId }) : null;
          if (oldRecord) {
            const touchFn = oldRecord.touchLater ?? oldRecord.touch;
            if (typeof touchFn === "function") {
              await (touch !== true ? touchFn.call(oldRecord, touch) : touchFn.call(oldRecord));
            }
          }
        }
      }
    }

    // Touch the current parent by looking it up via FK value.
    // We can't use record[name] (association reader) because it returns
    // the cached target which is null for newly created records.
    const fkValue =
      typeof record.readAttribute === "function"
        ? record.readAttribute(foreignKey)
        : record[foreignKey];
    if (fkValue != null) {
      const association =
        typeof record.association === "function" ? record.association(name) : null;
      if (association) {
        const klass = association.klass;
        if (klass && typeof klass.findBy === "function") {
          const pk =
            association.reflection?.associationPrimaryKey?.(klass) ?? klass.primaryKey ?? "id";
          const parent = await klass.findBy({ [pk as string]: fkValue });
          if (parent) {
            const touchFn = parent.touchLater ?? parent.touch;
            if (typeof touchFn === "function") {
              await (touch !== true ? touchFn.call(parent, touch) : touchFn.call(parent));
            }
          }
        }
      }
    }
  }

  static addTouchCallbacks(model: any, reflection: any): void {
    const foreignKey = reflection.foreignKey ?? reflection.options?.foreignKey;
    const foreignKeys: string[] = Array.isArray(foreignKey) ? foreignKey : [foreignKey];
    const name = reflection.name;
    const touch = reflection.options?.touch;

    const makeCallback = (changesMethod: string) => async (record: any) => {
      const raw = record[changesMethod];
      const changes = (typeof raw === "function" ? raw.call(record) : raw) ?? {};
      for (const key of foreignKeys) {
        await BelongsTo.touchRecord(record, changes, key, name, touch);
      }
    };

    if (reflection.counterCacheColumn?.() ?? reflection.options?.counterCache) {
      const touchCb = makeCallback("savedChanges");
      afterUpdate(model, async (record: any) => {
        const assoc = record.association(name);
        if (!assoc.isSavedChangeToTarget()) {
          await touchCb(record);
        }
      });
    } else {
      afterCreate(model, makeCallback("savedChanges"));
      afterUpdate(model, makeCallback("savedChanges"));
      afterDestroy(model, makeCallback("changesToSave"));
    }
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
    const name = reflection.name;
    afterDestroy(model, (record: any) => {
      return record.association(name).handleDependency();
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

    if (required) {
      // Rails validates the association name (reflection.name) which
      // checks whether the associated record can be loaded. Our codebase
      // validates the foreign key directly since association-aware presence
      // validation is not yet wired. The effect is the same: reject nil FK.
      const rawFk =
        reflection.foreignKey ?? options.foreignKey ?? `${underscore(reflection.name)}_id`;
      const foreignKeys = Array.isArray(rawFk) ? rawFk : [rawFk];

      if (model.belongsToRequiredValidatesForeignKey ?? true) {
        if (typeof model.validatesPresenceOf === "function") {
          for (const key of foreignKeys) {
            model.validatesPresenceOf(key, { message: "required" });
          }
        } else if (typeof model.validates === "function") {
          for (const key of foreignKeys) {
            model.validates(key, { presence: true });
          }
        }
      } else {
        const foreignTypes = reflection.options?.polymorphic
          ? Array.isArray(reflection.foreignType)
            ? (reflection.foreignType as string[])
            : [reflection.foreignType ?? `${underscore(reflection.name)}_type`]
          : [];

        const needsValidation = (record: any, attrs: string[]) =>
          attrs.some(
            (attr) =>
              record.readAttribute(attr) == null ||
              (typeof record.attributeChanged === "function" && record.attributeChanged(attr)),
          );

        const condition = (record: any) =>
          needsValidation(record, foreignKeys) ||
          (reflection.options?.polymorphic && needsValidation(record, foreignTypes));

        if (typeof model.validates === "function") {
          for (const key of foreignKeys) {
            model.validates(key, { presence: true, if: condition });
          }
        }
      }
    }
  }

  static override defineChangeTrackingMethods(model: any, reflection: any): void {
    const mixin = model.prototype ?? model;
    if (!mixin || typeof mixin !== "object") return;
    const name = reflection.name ?? reflection;

    for (const [methodName, impl] of [
      [
        `${name}Changed`,
        function (this: any) {
          return this.association(name).isTargetChanged();
        },
      ],
      [
        `${name}PreviouslyChanged`,
        function (this: any) {
          return this.association(name).isTargetPreviouslyChanged();
        },
      ],
    ] as [string, () => any][]) {
      const existing = Object.getOwnPropertyDescriptor(mixin, methodName);
      if (existing && !existing.configurable) continue;
      Object.defineProperty(mixin, methodName, {
        value: impl,
        writable: true,
        configurable: true,
      });
    }
  }
}
