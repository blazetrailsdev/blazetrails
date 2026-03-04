/**
 * Error detail stored in the Errors collection.
 */
export interface ErrorDetail {
  attribute: string;
  type: string;
  message: string;
  options?: Record<string, unknown>;
}

/**
 * Errors — collects validation error messages on a model.
 *
 * Mirrors: ActiveModel::Errors
 */
export class Errors {
  private _errors: ErrorDetail[] = [];

  /**
   * Add an error for an attribute.
   */
  add(
    attribute: string,
    type: string = "invalid",
    options?: { message?: string } & Record<string, unknown>
  ): void {
    const message = options?.message ?? this.defaultMessage(type, options);
    this._errors.push({ attribute, type, message, options });
  }

  /**
   * Get error messages for a specific attribute.
   */
  get(attribute: string): string[] {
    return this._errors
      .filter((e) => e.attribute === attribute)
      .map((e) => e.message);
  }

  /**
   * Bracket accessor — alias for get().
   */
  on(attribute: string): string[] {
    return this.get(attribute);
  }

  /**
   * Filter errors by attribute and/or type.
   */
  where(
    attribute: string,
    type?: string
  ): ErrorDetail[] {
    return this._errors.filter(
      (e) =>
        e.attribute === attribute && (type === undefined || e.type === type)
    );
  }

  /**
   * All full messages: "Attribute message".
   */
  get fullMessages(): string[] {
    return this._errors.map((e) => {
      if (e.attribute === "base") return e.message;
      const attr = e.attribute.charAt(0).toUpperCase() + e.attribute.slice(1);
      return `${attr} ${e.message}`;
    });
  }

  /**
   * Number of errors.
   */
  get count(): number {
    return this._errors.length;
  }

  get size(): number {
    return this._errors.length;
  }

  /**
   * Whether there are any errors.
   */
  get any(): boolean {
    return this._errors.length > 0;
  }

  get empty(): boolean {
    return this._errors.length === 0;
  }

  /**
   * Clear all errors.
   */
  clear(): void {
    this._errors = [];
  }

  /**
   * Get all error details.
   */
  get details(): ErrorDetail[] {
    return [...this._errors];
  }

  /**
   * All attribute names that have errors.
   */
  get attributeNames(): string[] {
    return [...new Set(this._errors.map((e) => e.attribute))];
  }

  private defaultMessage(
    type: string,
    _options?: Record<string, unknown>
  ): string {
    const messages: Record<string, string> = {
      invalid: "is invalid",
      blank: "can't be blank",
      present: "must be blank",
      too_short: "is too short",
      too_long: "is too long",
      wrong_length: "is the wrong length",
      not_a_number: "is not a number",
      not_an_integer: "is not an integer",
      greater_than: "must be greater than %{count}",
      greater_than_or_equal_to: "must be greater than or equal to %{count}",
      less_than: "must be less than %{count}",
      less_than_or_equal_to: "must be less than or equal to %{count}",
      equal_to: "must be equal to %{count}",
      other_than: "must be other than %{count}",
      odd: "must be odd",
      even: "must be even",
      inclusion: "is not included in the list",
      exclusion: "is reserved",
      taken: "has already been taken",
      confirmation: "doesn't match confirmation",
      accepted: "must be accepted",
    };
    let msg = messages[type] ?? type;
    if (_options) {
      for (const [key, val] of Object.entries(_options)) {
        msg = msg.replace(`%{${key}}`, String(val));
      }
    }
    return msg;
  }
}
