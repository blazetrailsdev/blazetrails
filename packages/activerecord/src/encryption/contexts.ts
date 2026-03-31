import { NullEncryptor } from "./null-encryptor.js";
import { EncryptingOnlyEncryptor } from "./encrypting-only-encryptor.js";

class ContextData {
  encryptor?: any;
  frozenEncryption?: boolean;
  [key: string]: unknown;
}

/**
 * Manages encryption context stack. Supports nested contexts
 * for temporarily changing encryption behavior.
 *
 * Mirrors: ActiveRecord::Encryption::Contexts
 */
export class Contexts {
  private static _defaultContext: ContextData = new ContextData();
  private static _contextStack: ContextData[] = [];

  static get defaultContext(): ContextData {
    return this._defaultContext;
  }

  static set defaultContext(ctx: ContextData) {
    this._defaultContext = ctx;
  }

  static get context(): ContextData {
    return this._contextStack.length > 0
      ? this._contextStack[this._contextStack.length - 1]
      : this._defaultContext;
  }

  static withEncryptionContext<T>(properties: Partial<ContextData>, fn: () => T): T {
    const ctx = Object.assign(new ContextData(), this.context, properties);
    this._contextStack.push(ctx);
    try {
      return fn();
    } finally {
      this._contextStack.pop();
    }
  }

  static withoutEncryption<T>(fn: () => T): T {
    return this.withEncryptionContext({ encryptor: new NullEncryptor() } as any, fn);
  }

  static protectingEncryptedData<T>(fn: () => T): T {
    return this.withEncryptionContext(
      { encryptor: new EncryptingOnlyEncryptor(), frozenEncryption: true } as any,
      fn,
    );
  }

  static resetDefaultContext(): void {
    this._defaultContext = new ContextData();
  }
}
