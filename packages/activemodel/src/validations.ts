/**
 * Raised by validateBang when validation fails.
 *
 * Mirrors: ActiveModel::ValidationError
 */
export class ValidationError extends Error {
  readonly model: unknown;

  constructor(model: { errors: { fullMessages: string[] } }) {
    super(`Validation failed: ${model.errors.fullMessages.join(", ")}`);
    this.name = "ValidationError";
    this.model = model;
  }
}
