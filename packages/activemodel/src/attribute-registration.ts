export interface AttributeRegistration {
  _brand?: "AttributeRegistration";
}

export interface AttributeRegistrationClassMethods {
  attribute(name: string, type?: string, options?: Record<string, unknown>): void;
  decorateAttributes(names: string[], fn: (name: string, value: unknown) => unknown): void;
  attributeTypes(): Record<string, unknown>;
  typeForAttribute(name: string): unknown;
}
