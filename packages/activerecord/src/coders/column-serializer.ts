import { SerializationTypeMismatch } from "../errors.js";

/**
 * Wraps a coder (e.g. YAML, JSON) with object-class validation so that
 * serialized columns only accept instances of the declared class.
 *
 * Mirrors: ActiveRecord::Coders::ColumnSerializer
 */
export class ColumnSerializer {
  readonly objectClass: new (...args: unknown[]) => unknown;
  readonly coder: { dump(obj: unknown): unknown; load(payload: unknown): unknown };
  private _attrName: string;

  constructor(
    attrName: string,
    coder: { dump(obj: unknown): unknown; load(payload: unknown): unknown },
    objectClass: new (...args: unknown[]) => unknown = Object as unknown as new () => unknown,
  ) {
    this._attrName = attrName;
    this.objectClass = objectClass;
    this.coder = coder;
    this._checkArityOfConstructor();
  }

  /**
   * Restore from a serialized YAML coder representation.
   *
   * Mirrors: ActiveRecord::Coders::ColumnSerializer#init_with
   */
  initWith(coder: {
    attr_name: string;
    object_class: new (...args: unknown[]) => unknown;
    coder: { dump(obj: unknown): unknown; load(payload: unknown): unknown };
  }): void {
    this._attrName = coder.attr_name;
    (this as any).objectClass = coder.object_class;
    (this as any).coder = coder.coder;
  }

  /**
   * Mirrors: ActiveRecord::Coders::ColumnSerializer#dump
   */
  dump(object: unknown): unknown {
    if (object == null) return undefined;
    this.assertValidValue(object, "dump");
    return this.coder.dump(object);
  }

  /**
   * Mirrors: ActiveRecord::Coders::ColumnSerializer#load
   */
  load(payload: unknown): unknown {
    if (payload == null) {
      if (this.objectClass !== (Object as unknown)) {
        return new (this.objectClass as new () => unknown)();
      }
      return null;
    }

    let object = this.coder.load(payload);
    this.assertValidValue(object, "load");

    if (object == null && this.objectClass !== (Object as unknown)) {
      object = new (this.objectClass as new () => unknown)();
    }

    return object;
  }

  /**
   * Mirrors: ActiveRecord::Coders::ColumnSerializer#assert_valid_value
   */
  assertValidValue(object: unknown, action: string): void {
    if (object == null) return;
    if (!(object instanceof this.objectClass)) {
      throw new SerializationTypeMismatch(
        `can't ${action} \`${this._attrName}\`: was supposed to be a ${this.objectClass.name}, ` +
          `but was a ${(object as object).constructor?.name ?? typeof object}. -- ${String(object)}`,
      );
    }
  }

  private _checkArityOfConstructor(): void {
    try {
      this.load(null);
    } catch (e: unknown) {
      if (e instanceof TypeError && String(e).includes("argument")) {
        throw new TypeError(
          `Cannot serialize ${this.objectClass.name}. Classes passed to \`serialize\` must have a 0 argument constructor.`,
        );
      }
    }
  }
}
