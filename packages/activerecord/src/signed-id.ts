import type { Base } from "./base.js";
import { RecordNotFound } from "./errors.js";

/**
 * Signed ID generation and lookup for ActiveRecord models.
 * Uses base64-encoded JSON payloads with optional purpose scoping
 * and expiration.
 *
 * Mirrors: ActiveRecord::SignedId
 */

/**
 * Generate a signed ID for a persisted record.
 *
 * Mirrors: ActiveRecord::SignedId#signed_id
 */
export function signedId(
  instance: Base,
  options?: { purpose?: string; expiresIn?: number },
): string {
  if (!instance.isPersisted()) {
    throw new Error("Cannot generate a signed_id for a new record");
  }
  const payload: Record<string, unknown> = { id: instance.id };
  if (options?.purpose) payload.purpose = options.purpose;
  if (options?.expiresIn) payload.expiresAt = Date.now() + options.expiresIn;
  const json = JSON.stringify(payload);
  if (typeof btoa === "function") {
    return btoa(json);
  }
  return Buffer.from(json).toString("base64");
}

/**
 * Find a record by its signed ID, or return null.
 *
 * Mirrors: ActiveRecord::SignedId::ClassMethods#find_signed
 */
export async function findSigned(
  modelClass: typeof Base,
  token: string,
  options?: { purpose?: string },
): Promise<Base | null> {
  try {
    let json: string;
    if (typeof atob === "function") {
      json = atob(token);
    } else {
      json = Buffer.from(token, "base64").toString("utf-8");
    }
    const payload = JSON.parse(json);
    if (options?.purpose && payload.purpose !== options.purpose) return null;
    if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
    if (Array.isArray(modelClass.primaryKey)) {
      const conditions: Record<string, unknown> = {};
      (modelClass.primaryKey as string[]).forEach((col, i) => {
        conditions[col] = payload.id[i];
      });
      return modelClass.findBy(conditions);
    }
    return modelClass.findBy({ [modelClass.primaryKey as string]: payload.id });
  } catch {
    return null;
  }
}

/**
 * Find a record by its signed ID, or throw RecordNotFound.
 *
 * Mirrors: ActiveRecord::SignedId::ClassMethods#find_signed!
 */
export async function findSignedBang(
  modelClass: typeof Base,
  token: string,
  options?: { purpose?: string },
): Promise<Base> {
  const record = await findSigned(modelClass, token, options);
  if (!record) {
    throw new RecordNotFound(`${modelClass.name} not found with signed id`, modelClass.name);
  }
  return record;
}
