import type { EncryptedAttributeType } from "./encrypted-attribute-type.js";

/**
 * Automatically expands encrypted arguments to support querying both
 * encrypted and unencrypted data during encryption migration periods.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries
 */
export class ExtendedDeterministicQueries {
  private static _installed = false;

  static installSupport(): void {
    this._installed = true;
  }

  static get installed(): boolean {
    return this._installed;
  }
}

/**
 * Processes query arguments, expanding encrypted values to include
 * ciphertexts from previous encryption schemes.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries::EncryptedQuery
 */
export class EncryptedQuery {
  static processArguments(
    owner: any,
    args: unknown[],
    checkForAdditionalValues: boolean,
  ): unknown[] {
    const model = owner._modelClass ?? owner;
    const deterministicAttrs = model._encryptedAttributes;
    if (!deterministicAttrs?.size) return args;

    if (!Array.isArray(args) || args.length === 0) return args;
    const options = args[0];
    if (typeof options !== "object" || options === null) return args;

    const result = { ...options } as Record<string, unknown>;
    let modified = false;

    for (const attrName of deterministicAttrs) {
      const type = model.typeForAttribute?.(attrName) as EncryptedAttributeType | undefined;
      if (!type?.previousTypes?.length) continue;
      const value = result[attrName];
      if (value === undefined) continue;
      result[attrName] = this.processEncryptedQueryArgument(value, checkForAdditionalValues, type);
      modified = true;
    }

    if (modified) args[0] = result;
    return args;
  }

  private static processEncryptedQueryArgument(
    value: unknown,
    checkForAdditionalValues: boolean,
    type: EncryptedAttributeType,
  ): unknown {
    if (typeof value === "string") {
      const additional = type.previousTypes.map((t) => new AdditionalValue(value, t));
      return [value, ...additional];
    }
    if (Array.isArray(value)) {
      if (checkForAdditionalValues && value.some((v) => v instanceof AdditionalValue)) {
        return value;
      }
      const expanded = value.flatMap((v) => {
        if (typeof v === "string") {
          return type.previousTypes.map((t) => new AdditionalValue(v, t));
        }
        return [];
      });
      return [...value, ...expanded];
    }
    return value;
  }
}

/**
 * Mixin that patches Relation#where and Relation#exists? to expand
 * encrypted query arguments via EncryptedQuery.processArguments.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries::RelationQueries
 */
export class RelationQueries {
  static patchWhere(originalWhere: Function, relation: any, args: unknown[]): unknown {
    return originalWhere.call(relation, ...EncryptedQuery.processArguments(relation, args, true));
  }

  static patchExists(originalExists: Function, relation: any, args: unknown[]): unknown {
    return originalExists.call(relation, ...EncryptedQuery.processArguments(relation, args, true));
  }
}

/**
 * Mixin that patches Base.findBy to expand encrypted query arguments.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries::CoreQueries
 */
export class CoreQueries {
  static patchFindBy(originalFindBy: Function, klass: any, args: unknown[]): unknown {
    return originalFindBy.call(klass, ...EncryptedQuery.processArguments(klass, args, false));
  }
}

/**
 * Wraps a value encrypted with a previous scheme so it can be
 * included in query expansion without re-encryption.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries::AdditionalValue
 */
export class AdditionalValue {
  readonly value: unknown;
  readonly type: EncryptedAttributeType;

  constructor(value: unknown, type: EncryptedAttributeType) {
    this.type = type;
    this.value = type.serialize(value);
  }
}

/**
 * Patches EncryptedAttributeType#serialize to pass through
 * AdditionalValue instances without re-encrypting.
 *
 * Mirrors: ActiveRecord::Encryption::ExtendedDeterministicQueries::ExtendedEncryptableType
 */
export class ExtendedEncryptableType {
  static serialize(originalSerialize: (data: unknown) => unknown, data: unknown): unknown {
    if (data instanceof AdditionalValue) {
      return data.value;
    }
    return originalSerialize(data);
  }
}
