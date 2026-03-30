/**
 * Deprecator — handles deprecation warnings for ActiveModel.
 *
 * Mirrors: ActiveModel.deprecator (ActiveSupport::Deprecation instance)
 *
 * In Rails, each framework has its own deprecator instance. This provides
 * the same pattern for @blazetrails/activemodel.
 */
export class Deprecator {
  private _silenced = false;

  warn(message: string, callerId?: string): void {
    if (this._silenced) return;
    const prefix = callerId ? `[${callerId}] ` : "";
    console.warn(`DEPRECATION WARNING: ${prefix}${message}`);
  }

  get silenced(): boolean {
    return this._silenced;
  }

  set silenced(value: boolean) {
    this._silenced = value;
  }

  silence<T>(fn: () => T): T {
    const prev = this._silenced;
    this._silenced = true;
    try {
      return fn();
    } finally {
      this._silenced = prev;
    }
  }
}

export const deprecator = new Deprecator();

/**
 * Mirrors: ActiveModel (the root module that exposes .deprecator)
 *
 * In Rails, ActiveModel.deprecator is defined in deprecator.rb,
 * so the Ruby API extractor assigns the ActiveModel module to this file.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ActiveModel {
  export const dep = deprecator;
}
