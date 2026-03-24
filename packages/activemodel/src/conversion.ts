export interface Conversion {
  toModel(): unknown;
  toKey(): unknown[];
  toParam(): string | null;
  toPartialPath(): string;
}
