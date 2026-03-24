export class MissingAttributeError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "MissingAttributeError";
  }
}

export interface AttributeMethods {
  attributePresent(attr: string): boolean;
  hasAttribute(attr: string): boolean;
}

export class AttributeMethodPattern {
  readonly prefix: string;
  readonly suffix: string;
  constructor(prefix: string = "", suffix: string = "") {
    this.prefix = prefix;
    this.suffix = suffix;
  }
}
