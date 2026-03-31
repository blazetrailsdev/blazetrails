/**
 * Deprecator — handles deprecation warnings for ActionController.
 *
 * Mirrors: ActionController.deprecator (ActiveSupport::Deprecation instance)
 * @see https://api.rubyonrails.org/classes/ActionController.html
 */

export class Deprecator {
  readonly gem: string;

  constructor(gem = "actionpack") {
    this.gem = gem;
  }

  warn(message: string, _callStack?: string[]): void {
    process.stderr.write(`DEPRECATION WARNING: ${message} (from ${this.gem})\n`);
  }
}

export const deprecator = new Deprecator();

export interface ActionController {
  readonly deprecator: Deprecator;
}
