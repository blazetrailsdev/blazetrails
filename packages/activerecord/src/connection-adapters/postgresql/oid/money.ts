/**
 * PostgreSQL money type — currency amount.
 *
 * Mirrors: ActiveRecord::ConnectionAdapters::PostgreSQL::OID::Money
 */

export class Money {
  get type(): string {
    return "decimal";
  }

  get precision(): number | undefined {
    return undefined;
  }

  get scale(): number {
    return 2;
  }

  cast(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      if (value === "") return null;
      const cleaned = value.replace(/[$,\s]/g, "");
      const parsed = parseFloat(cleaned);
      if (isNaN(parsed)) return null;
      return parsed;
    }
    return null;
  }

  serialize(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === "number") return value.toFixed(2);
    if (typeof value === "string") return value;
    return null;
  }

  deserialize(value: unknown): number | null {
    return this.cast(value);
  }
}
