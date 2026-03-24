export interface Validations {
  isValid(context?: string): boolean;
  validate(context?: string): boolean;
  validateBang(context?: string): void;
  errors: unknown;
}

export class ValidationError extends globalThis.Error {
  readonly model: unknown;
  constructor(model: unknown) {
    super("Validation failed");
    this.name = "ValidationError";
    this.model = model;
  }
}

export class ValidationContext {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
}
