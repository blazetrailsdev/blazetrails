/**
 * Bind collector — collects bind params separately from the SQL.
 *
 * Mirrors: Arel::Collectors::Bind
 */
export class Bind {
  private parts: string[] = [];
  readonly binds: unknown[] = [];

  append(str: string): this {
    this.parts.push(str);
    return this;
  }

  addBind(value: unknown): this {
    this.binds.push(value);
    this.parts.push("?");
    return this;
  }

  get value(): [string, unknown[]] {
    return [this.parts.join(""), this.binds];
  }
}
