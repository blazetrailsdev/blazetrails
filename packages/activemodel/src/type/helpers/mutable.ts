export interface Mutable {
  cast(value: unknown): unknown;
  changedInPlace(rawOldValue: unknown, newValue: unknown): boolean;
  isMutable(): boolean;
}
