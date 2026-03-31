export abstract class NumberConverter<TOptions = Record<string, unknown>> {
  protected number: unknown;
  protected options: TOptions;

  constructor(number: unknown, options: TOptions = {} as TOptions) {
    this.number = number;
    this.options = options;
  }

  abstract convert(): string;

  protected validFloat(number: unknown): number {
    if (typeof number === "number") return number;
    if (typeof number === "string") {
      const trimmed = number.trim();
      if (trimmed === "") return 0;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }
}
