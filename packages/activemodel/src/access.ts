export interface Access {
  slice(...methods: string[]): Record<string, unknown>;
  values_at(...methods: string[]): unknown[];
}
