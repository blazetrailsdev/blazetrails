export interface Numeric {
  serialize(value: unknown): unknown;
  cast(value: unknown): unknown;
  isChanged(oldValue: unknown, newValue: unknown): boolean;
}
