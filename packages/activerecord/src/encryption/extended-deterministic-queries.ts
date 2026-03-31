import { EncryptedAttributeType } from "./encrypted-attribute-type.js";

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
 * Processes query arguments, expanding deterministic encrypted values
 * to include ciphertexts from previous encryption schemes.
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
    const encryptedAttrs = model._encryptedAttributes as Set<string> | undefined;
    if (!encryptedAttrs?.size) return args;

    if (!Array.isArray(args) || args.length === 0) return args;
    const options = args[0];
    if (typeof options !== "object" || options === null) return args;

    const result = { ...options } as Record<string, unknown>;
    let modified = false;

    for (const attrName of encryptedAttrs) {
      const type = model.typeForAttribute?.(attrName);
      if (!(type instanceof EncryptedAttributeType)) continue;
      if (!type.deterministic) continue;
      if (!type.previousTypes.length) continue;
      const value = result[attrName];
      if (value === undefined) continue;
      result[attrName] = this.processEncryptedQueryArgument(value, checkForAdditionalValues, type);
      modified = true;
    }

    return modified ? [result, ...args.slice(1)] : args;
  }

  private static processEncryptedQueryArgument(
    value: unknown,
    _checkForAdditionalValues: boolean,
    type: EncryptedAttributeType,
  ): unknown {
    if (typeof value === "string") {
      return this.allCiphertextsFor(value, type);
    }
    if (Array.isArray(value)) {
      const expanded = value.flatMap((v) => {
        if (typeof v === "string") {
          return this.allCiphertextsFor(v, type);
        }
        return [v];
      });
      return expanded;
    }
    return value;
  }

  private static allCiphertextsFor(plaintext: string, type: EncryptedAttributeType): string[] {
    const results: string[] = [];
    // Current scheme ciphertext
    const current = type.serialize(plaintext);
    if (typeof current === "string") results.push(current);
    // Previous scheme ciphertexts
    for (const prev of type.previousTypes) {
      const ct = prev.serialize(plaintext);
      if (typeof ct === "string") results.push(ct);
    }
    // Include plaintext for support_unencrypted_data migration
    if (!results.includes(plaintext)) results.push(plaintext);
    return results;
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
 * Wraps a value encrypted with a previous scheme. Used as a marker
 * during query expansion to track which values are already encrypted.
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
