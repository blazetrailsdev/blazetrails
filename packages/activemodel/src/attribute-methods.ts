/**
 * Raised when accessing an attribute that doesn't exist.
 *
 * Mirrors: ActiveModel::MissingAttributeError
 */
export class MissingAttributeError extends globalThis.Error {
  constructor(message?: string) {
    super(message);
    this.name = "MissingAttributeError";
  }
}
