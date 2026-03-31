import { Config } from "./config.js";

/**
 * Configuration API for ActiveRecord::Encryption. Provides methods
 * to configure encryption keys and properties, and to register
 * callbacks for encrypted attribute declarations.
 *
 * Mirrors: ActiveRecord::Encryption::Configurable
 */
export class Configurable {
  private static _config: Config | null = null;
  private static _listeners: Array<(klass: any, name: string) => void> = [];

  static get config(): Config {
    if (!this._config) {
      this._config = new Config();
    }
    return this._config;
  }

  static configure(options: {
    primaryKey?: string;
    deterministicKey?: string;
    keyDerivationSalt?: string;
    [key: string]: unknown;
  }): void {
    const config = this.config;
    if (options.primaryKey !== undefined) config.primaryKey = options.primaryKey;
    if (options.deterministicKey !== undefined) config.deterministicKey = options.deterministicKey;
    if (options.keyDerivationSalt !== undefined)
      config.keyDerivationSalt = options.keyDerivationSalt;

    for (const [key, value] of Object.entries(options)) {
      if (key !== "primaryKey" && key !== "deterministicKey" && key !== "keyDerivationSalt") {
        (config as any)[key] = value;
      }
    }
  }

  static onEncryptedAttributeDeclared(callback: (klass: any, name: string) => void): void {
    this._listeners.push(callback);
  }

  static encryptedAttributeWasDeclared(klass: any, name: string): void {
    for (const listener of this._listeners) {
      listener(klass, name);
    }
  }
}
