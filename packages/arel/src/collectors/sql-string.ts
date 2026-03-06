/**
 * SQLString collector — accumulates SQL fragments into a single string.
 *
 * Mirrors: Arel::Collectors::SQLString
 */
export class SQLString {
  private parts: string[] = [];
  readonly bindValues: unknown[] = [];
  retryable = true;

  append(str: string): this {
    this.parts.push(str);
    return this;
  }

  addBind(value: unknown): this {
    this.bindValues.push(value);
    this.parts.push("?");
    return this;
  }

  get value(): string {
    return this.parts.join("");
  }
}
