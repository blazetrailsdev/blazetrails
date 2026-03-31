export class RoundingHelper {
  private precision: number;
  private significant: boolean;

  constructor(options: { precision?: number; significant?: boolean } = {}) {
    this.precision = options.precision ?? 3;
    this.significant = options.significant ?? false;
  }

  round(number: number): number {
    if (this.significant) {
      return this.roundSignificant(number);
    }
    return this.roundPrecision(number);
  }

  private roundPrecision(number: number): number {
    const factor = Math.pow(10, this.precision);
    return Math.round(number * factor) / factor;
  }

  private roundSignificant(number: number): number {
    if (number === 0) return 0;
    const d = Math.ceil(Math.log10(Math.abs(number)));
    const power = this.precision - d;
    const magnitude = Math.pow(10, power);
    return Math.round(number * magnitude) / magnitude;
  }
}
