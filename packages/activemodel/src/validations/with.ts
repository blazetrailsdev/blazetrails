export interface Validations {
  isValid(context?: string): boolean;
  validate(context?: string): boolean;
}

export class WithValidator {
  readonly validators: unknown[];
  readonly options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.validators = [];
    this.options = options;
  }
}
