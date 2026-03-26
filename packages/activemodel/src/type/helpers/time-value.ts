export interface TimeValue {
  applySecondsPrecision(value: unknown): unknown;
  userInputInTimeZone(value: unknown): unknown;
}
