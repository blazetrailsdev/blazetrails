export class AcceptsMultiparameterTime {
  readonly type: unknown;
  constructor(type: unknown) {
    this.type = type;
  }
}

export interface InstanceMethods {
  serialize(value: unknown): unknown;
  cast(value: unknown): unknown;
  assertValidValue(value: unknown): void;
}
