/**
 * Raised by save! when the record is invalid.
 *
 * Mirrors: ActiveRecord::RecordInvalid
 */
export class RecordInvalid extends Error {
  readonly record: any;

  constructor(record: any) {
    const messages = record.errors?.fullMessages?.join(", ") ?? "Validation failed";
    super(`Validation failed: ${messages}`);
    this.name = "RecordInvalid";
    this.record = record;
  }
}
