/**
 * Raised by validateBang when validation fails.
 *
 * Mirrors: ActiveModel::ValidationError
 */
export class ValidationError extends globalThis.Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly model: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(model: any) {
    super(`Validation failed: ${model.errors.fullMessages.join(", ")}`);
    this.name = "ValidationError";
    this.model = model;
  }
}

/**
 * Represents a named validation context (e.g., :create, :update).
 *
 * Mirrors: ActiveModel::ValidationContext
 */
export class ValidationContext {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }

  toString(): string {
    return this.name;
  }
}

export interface Validations {
  errors: unknown;
  isValid(context?: string): boolean;
  validate(context?: string): unknown;
  isInvalid(): boolean;
  validateBang(context?: string): boolean;
  validationContext: string | undefined;
  validatesWith(...args: unknown[]): void;
}

export interface ValidationsClassMethods {
  validatesEach(attributes: string[], fn: unknown): void;
  validate(fn: unknown, options?: Record<string, unknown>): void;
  validators(): unknown[];
  clearValidators(): void;
  validatorsOn(attribute: string): unknown[];
  validates(attribute: string, options: Record<string, unknown>): void;
  validatesBang(attribute: string, options: Record<string, unknown>): void;
  validatesWith(...args: unknown[]): void;
}
