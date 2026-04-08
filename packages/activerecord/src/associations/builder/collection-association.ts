import { singularize } from "@blazetrails/activesupport";
import { Association } from "./association.js";

const CALLBACKS = ["beforeAdd", "afterAdd", "beforeRemove", "afterRemove"] as const;

/**
 * Base builder for has_many and HABTM associations.
 *
 * Mirrors: ActiveRecord::Associations::Builder::CollectionAssociation
 */
export class CollectionAssociation extends Association {
  static override validOptions(options: Record<string, unknown>): string[] {
    return [
      ...super.validOptions(options),
      "beforeAdd",
      "afterAdd",
      "beforeRemove",
      "afterRemove",
      "extend",
    ];
  }

  static override defineCallbacks(model: any, reflection: any): void {
    super.defineCallbacks(model, reflection);
    const name = reflection.name ?? reflection;
    const options = reflection.options ?? {};
    for (const callbackName of CALLBACKS) {
      this.defineCallback(model, callbackName, name, options);
    }
  }

  static override defineExtensions(model: any, name: string, block?: Function): any {
    if (block) {
      const extensionModuleName = `${name.charAt(0).toUpperCase()}${name.slice(1)}AssociationExtension`;
      const extension = { name: extensionModuleName, block };
      (model as any)[extensionModuleName] = extension;
      return extension;
    }
    return undefined;
  }

  static defineCallback(
    model: any,
    callbackName: string,
    name: string,
    options: Record<string, unknown>,
  ): void {
    const fullCallbackName = `${callbackName}For${name.charAt(0).toUpperCase()}${name.slice(1)}`;

    const callbackValues = Array.isArray(options[callbackName])
      ? (options[callbackName] as any[])
      : options[callbackName] != null
        ? [options[callbackName]]
        : [];

    const methodDefined = fullCallbackName in model;

    if ((callbackValues as any[]).length === 0) return;

    if (!methodDefined) {
      model[fullCallbackName] = [];
    }

    const callbacks = (callbackValues as any[]).map((callback: any) => {
      if (typeof callback === "string" || typeof callback === "symbol") {
        return (_method: string, owner: any, record: any) => owner[callback](record);
      } else if (typeof callback === "function") {
        return (_method: string, owner: any, record: any) => callback(owner, record);
      } else {
        return (method: string, owner: any, record: any) => callback[method](owner, record);
      }
    });

    model[fullCallbackName] = [...(model[fullCallbackName] ?? []), ...callbacks];
  }

  static override defineReaders(mixin: any, name: string): void {
    super.defineReaders(mixin, name);
    if (mixin instanceof Set) {
      const singular = singularize(name);
      mixin.add(`${singular}Ids`);
    }
  }

  static override defineWriters(mixin: any, name: string): void {
    super.defineWriters(mixin, name);
    if (mixin instanceof Set) {
      const singular = singularize(name);
      mixin.add(`${singular}Ids=`);
    }
  }
}
