export interface Translation {
  humanAttributeName(attribute: string, options?: Record<string, unknown>): string;
  i18nScope(): string;
  lookupAncestors(): unknown[];
}
