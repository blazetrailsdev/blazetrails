export interface Type {
  register(name: string, factory: unknown): void;
  lookup(name: string): unknown;
}
