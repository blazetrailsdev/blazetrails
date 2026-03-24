export class Error {
  readonly base: unknown;
  readonly attribute: string;
  readonly type: string;
  readonly options: Record<string, unknown>;

  constructor(
    base: unknown,
    attribute: string,
    type: string = "invalid",
    options: Record<string, unknown> = {},
  ) {
    this.base = base;
    this.attribute = attribute;
    this.type = type;
    this.options = options;
  }

  get message(): string {
    return (this.options.message as string) ?? this.type;
  }
}
