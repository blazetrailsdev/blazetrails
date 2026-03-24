export class Attribute {
  readonly name: string;
  readonly valueBeforeTypeCast: unknown;
  readonly type: unknown;

  constructor(name: string, valueBeforeTypeCast: unknown, type: unknown) {
    this.name = name;
    this.valueBeforeTypeCast = valueBeforeTypeCast;
    this.type = type;
  }
}

export class FromDatabase extends Attribute {}
export class FromUser extends Attribute {}
export class WithCastValue extends Attribute {}
export class Null extends Attribute {
  constructor() {
    super("", null, null);
  }
}
export class Uninitialized extends Attribute {
  constructor(name: string, type: unknown) {
    super(name, undefined, type);
  }
}
