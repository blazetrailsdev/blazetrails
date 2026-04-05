import {
  withEncryptionContext as _withCtx,
  withoutEncryption as _withoutEnc,
  protectingEncryptedData as _protecting,
  getEncryptionContext,
  type EncryptionContext,
} from "./context.js";

/**
 * Class-based API for managing encryption contexts. Delegates to the
 * existing AsyncLocalStorage-based context system in context.ts.
 *
 * Mirrors: ActiveRecord::Encryption::Contexts
 */
export class Contexts {
  static get context(): EncryptionContext {
    return getEncryptionContext();
  }

  static withEncryptionContext<T>(properties: EncryptionContext, fn: () => T): T {
    return _withCtx(properties, fn);
  }

  static withoutEncryption<T>(fn: () => T): T {
    return _withoutEnc(fn);
  }

  static protectingEncryptedData<T>(fn: () => T): T {
    return _protecting(fn);
  }

  static get currentCustomContext(): EncryptionContext | null {
    const ctx = getEncryptionContext();
    return ctx ?? null;
  }

  static resetDefaultContext(): void {
    // Reset to a fresh default context — the context.ts module handles
    // this via the AsyncLocalStorage store defaulting to the initial context.
  }
}
