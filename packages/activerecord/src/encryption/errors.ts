/**
 * Encryption-specific error classes.
 *
 * Mirrors: ActiveRecord::Encryption::Errors
 */

export class Base extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "Encryption::Base";
  }
}

/** @deprecated Use Base instead */
export { Base as EncryptionError };

export class Encoding extends Base {
  constructor(message?: string) {
    super(message ?? "Encryption encoding error");
    this.name = "EncodingError";
  }
}

export class Decryption extends Base {
  constructor(message?: string) {
    super(message ?? "Failed to decrypt");
    this.name = "DecryptionError";
  }
}

/** @deprecated Use Decryption instead */
export { Decryption as DecryptionError };

export class Encryption extends Base {
  constructor(message?: string) {
    super(message ?? "Failed to encrypt");
    this.name = "EncryptionError";
  }
}

export class Configuration extends Base {
  constructor(message?: string) {
    super(message ?? "Encryption configuration error");
    this.name = "ConfigurationError";
  }
}

/** @deprecated Use Configuration instead */
export { Configuration as ConfigError };

export class ForbiddenClass extends Base {
  constructor(message?: string) {
    super(message ?? "Forbidden class");
    this.name = "ForbiddenClass";
  }
}

export class EncryptedContentIntegrity extends Base {
  constructor(message?: string) {
    super(message ?? "Encrypted content integrity violated");
    this.name = "EncryptedContentIntegrity";
  }
}
