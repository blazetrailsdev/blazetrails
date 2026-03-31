/**
 * ActionController::Deprecator
 *
 * Deprecation helper for ActionController.
 * @see https://api.rubyonrails.org/classes/ActionController.html
 */

export interface ActionController {
  deprecator(): Deprecator;
}

export class Deprecator {
  warn(message: string, _callStack?: string[]): void {
    console.warn(`DEPRECATION WARNING: ${message}`);
  }
}

export function deprecator(): Deprecator {
  return new Deprecator();
}
