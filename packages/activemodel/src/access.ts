export interface Access {
  slice(...methods: (string | string[])[]): Record<string, unknown>;
  valuesAt(...methods: (string | string[])[]): unknown[];
}
