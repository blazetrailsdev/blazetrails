export interface JSON {
  asJson(options?: Record<string, unknown>): Record<string, unknown>;
  fromJson(json: string, includeRoot?: boolean): unknown;
}
