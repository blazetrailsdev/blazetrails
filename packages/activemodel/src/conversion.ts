export interface Conversion {
  toModel(): unknown;
  toKey(): unknown[] | null;
  toParam(): string | null;
  toPartialPath(): string;
}

export interface ConversionClassMethods {
  toPartialPath(): string;
}
