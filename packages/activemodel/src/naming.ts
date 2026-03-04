/**
 * ModelName — naming conventions for a model class.
 *
 * Mirrors: ActiveModel::Name
 */
export class ModelName {
  readonly name: string;
  readonly singular: string;
  readonly plural: string;
  readonly element: string;
  readonly collection: string;
  readonly paramKey: string;
  readonly routeKey: string;
  readonly i18nKey: string;

  constructor(className: string) {
    this.name = className;
    const lower = this.underscore(className);
    this.singular = lower;
    this.plural = this.pluralize(lower);
    this.element = lower;
    this.collection = this.plural;
    this.paramKey = lower;
    this.routeKey = this.plural;
    this.i18nKey = lower;
  }

  private underscore(str: string): string {
    return str
      .replace(/::/g, "/")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .replace(/([a-z\d])([A-Z])/g, "$1_$2")
      .toLowerCase();
  }

  private pluralize(str: string): string {
    if (str.endsWith("s")) return str + "es";
    if (str.endsWith("y") && !/[aeiou]y$/.test(str)) {
      return str.slice(0, -1) + "ies";
    }
    return str + "s";
  }
}
