export interface Access {
  slice(...methods: string[]): Record<string, unknown>;
  valuesAt(...methods: string[]): unknown[];
}
