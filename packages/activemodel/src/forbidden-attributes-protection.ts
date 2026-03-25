/**
 * Raised when mass-assigning attributes that haven't been permitted.
 *
 * Mirrors: ActiveModel::ForbiddenAttributesError
 */
export class ForbiddenAttributesError extends Error {
  constructor(message?: string) {
    super(message ?? "Cannot mass-assign protected attributes");
    this.name = "ForbiddenAttributesError";
  }
}
