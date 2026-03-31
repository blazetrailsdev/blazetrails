export abstract class NumberConverter {
  protected number: unknown;
  protected options: Record<string, unknown>;

  constructor(number: unknown, options: Record<string, unknown> = {}) {
    this.number = number;
    this.options = options;
  }

  abstract convert(): string;

  protected validFloat(number: unknown): number {
    if (typeof number === "number") return number;
    if (typeof number === "string") {
      const parsed = parseFloat(number);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  }
}
