export class ForbiddenAttributesError extends Error {
  constructor(message?: string) {
    super(message ?? "Cannot mass-assign protected attributes");
    this.name = "ForbiddenAttributesError";
  }
}
