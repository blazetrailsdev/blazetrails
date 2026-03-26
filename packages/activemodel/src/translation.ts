export interface Translation {
  humanAttributeName(attribute: string, options?: Record<string, unknown>): string;
  readonly i18nScope: string;
  lookupAncestors(): unknown[];
}
